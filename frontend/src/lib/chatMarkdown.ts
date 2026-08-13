/**
 * Markdown rendering for chat messages (Agent 对话).
 *
 * Chat content comes straight from LLM output, so — unlike the document
 * preview — this renderer sanitizes aggressively: raw HTML is escaped instead
 * of rendered, and link/image URLs are restricted to safe protocols.
 *
 * It uses an isolated `Marked` instance rather than the global `marked`
 * singleton, because `lib/markdownSourceMap.ts` registers its source-mapping
 * renderer globally for the document preview; chat output must not carry
 * `data-mdx` annotations or depend on that module's import order.
 *
 * Math (`$...$` inline, `$$...$$` block) is rendered with KaTeX, mirroring
 * the document preview.
 */
import { Marked } from 'marked';
import type { Token, TokenizerAndRendererExtension } from 'marked';
import katex from 'katex';

/** Escape text for safe inclusion as HTML text (never called on math output). */
function escapeHtml(text: string, encodeQuotes = false): string {
  let escaped = text
    .replace(/&(?!(?:\w+|\w*;))/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return encodeQuotes ? escaped.replace(/'/g, '&#39;') : escaped;
}

/** Blocklist link/image protocols so model output cannot execute scripts. */
function safeUrl(url: string): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return '#';
  if (/^(javascript|vbscript|data|file):/i.test(trimmed)) return '#';
  return trimmed;
}

function renderMath(formula: string, displayMode: boolean, fallback: string): string {
  try {
    return katex.renderToString(formula, { displayMode, throwOnError: false });
  } catch {
    return escapeHtml(fallback);
  }
}

/* -------------------------------------------------------------------------- */
/* KaTeX math extensions (same syntax as the document preview)                */
/* -------------------------------------------------------------------------- */

const inlineMathExtension = {
  name: 'inlineMath',
  level: 'inline',
  start(src: string) {
    return src.match(/\$[^$\n]+\$/)?.index;
  },
  tokenizer(src: string) {
    const m = /^\$([^$\n]+)\$/.exec(src);
    if (m) {
      return { type: 'inlineMath', raw: m[0], text: m[1] };
    }
    return undefined;
  },
  renderer(token: { raw: string; text: string }) {
    return `<span>${renderMath(token.text, false, token.raw)}</span>`;
  },
};

const blockMathExtension = {
  name: 'blockMath',
  level: 'block',
  start(src: string) {
    return src.match(/^\$\$/m)?.index;
  },
  tokenizer(src: string) {
    const m = /^\$\$([^$]+)\$\$/.exec(src);
    if (m) {
      return { type: 'blockMath', raw: m[0], text: m[1] };
    }
    return undefined;
  },
  renderer(token: { raw: string; text: string }) {
    return `<div>${renderMath(token.text, true, token.raw)}</div>\n`;
  },
};

const chatMarked = new Marked({ gfm: true, breaks: true });

chatMarked.use({
  extensions: [
    inlineMathExtension as TokenizerAndRendererExtension,
    blockMathExtension as TokenizerAndRendererExtension,
  ],
  // Sanitize before the default renderers run: model output must not be able
  // to inject raw HTML or dangerous URLs into the chat view.
  walkTokens(token: Token) {
    if (token.type === 'html') {
      token.text = escapeHtml(token.text);
    }
    if (token.type === 'link' || token.type === 'image') {
      if (typeof token.href === 'string') {
        token.href = safeUrl(token.href);
      }
      if (typeof token.title === 'string') {
        token.title = escapeHtml(token.title);
      }
    }
  },
});

/** Render a chat message's Markdown source to sanitized HTML. */
export function renderChatMarkdown(source: string): string {
  if (!source || source.trim() === '') return '';
  return chatMarked.parse(source) as string;
}
