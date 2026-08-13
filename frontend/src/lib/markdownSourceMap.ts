/**
 * Source-mapped Markdown rendering.
 *
 * Renders Markdown to HTML the same way the plain preview does, but annotates
 * every rendered token with `data-mdx="<index>"`, where `<index>` points into a
 * registry of exact source offsets (`SourceEntry`). This lets us map a DOM text
 * selection in the *rendered* preview back to the original raw Markdown source
 * (headings keep their `#`, lists keep their `-`, tables keep their pipes,
 * formulas keep their `$...$`, code keeps its fences) instead of handing the
 * agent the flattened rendered text.
 *
 * Mapping model:
 * - A pre-pass walks the lexer token tree and locates each token's `raw` slice
 *   inside its parent's raw slice via sequential `indexOf`. Raw slices appear
 *   in source order inside their parent, so a running cursor resolves them
 *   unambiguously (nested markers like `**`, `> `, `- `, `|` are skipped
 *   naturally because children raws never include them).
 * - Entries carry a kind:
 *   - `leaf`:   plain text token, rendered text maps 1:1 onto its raw source.
 *   - `atomic`: tokens with syntax the renderer does not show (codespan,
 *               escapes, math, images, code blocks, hr) — any overlap with the
 *               selection contributes the whole raw token.
 *   - `container`: block/inline containers (paragraph, heading, list, item,
 *               table, cell, strong, em, link, …) — contributes its whole raw
 *               slice when the selection covers its entire rendered content,
 *               otherwise its children resolve.
 * - Resolution collects (a) every annotated element whose rendered content is
 *   fully inside the selection (full raw slice), and (b) the two boundary
 *   elements containing the selection endpoints (sliced for `leaf` kinds), then
 *   returns `source.slice(minStart, maxEnd)` — which preserves inter-token
 *   whitespace exactly.
 */
import {
  marked,
  Renderer,
  type MarkedExtension,
  type RendererObject,
  type TokenizerAndRendererExtension,
} from 'marked';
import katex from 'katex';

export type SourceEntryKind = 'leaf' | 'atomic' | 'container';

export interface SourceEntry {
  start: number;
  end: number;
  kind: SourceEntryKind;
}

export interface SourceMappedRender {
  html: string;
  source: string;
  /** Map a DOM Range (inside `root`) back to raw Markdown source text. */
  resolveRange: (root: HTMLElement, range: Range) => string;
}

/** Per-render state shared with renderer callbacks (render is synchronous). */
interface RenderContext {
  entries: SourceEntry[];
  tokenMap: WeakMap<object, number>;
  cellMap: WeakMap<object, number>;
}

let currentRender: RenderContext | null = null;

/* -------------------------------------------------------------------------- */
/* KaTeX math extensions (tokens carry raw `$...$` so offsets stay accurate)  */
/* -------------------------------------------------------------------------- */

function renderMath(formula: string, displayMode: boolean, fallback: string): string {
  try {
    return katex.renderToString(formula, { displayMode, throwOnError: false });
  } catch {
    return escapeHtml(fallback);
  }
}

function mathAttr(token: object): string {
  const idx = currentRender?.tokenMap.get(token);
  return idx === undefined ? '' : ` data-mdx="${idx}"`;
}

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
    const inner = renderMath(token.text, false, token.raw);
    return `<span${mathAttr(token)}>${inner}</span>`;
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
    const inner = renderMath(token.text, true, token.raw);
    return `<div${mathAttr(token)}>${inner}</div>\n`;
  },
};

/* -------------------------------------------------------------------------- */
/* Offset pre-pass                                                             */
/* -------------------------------------------------------------------------- */

interface Cursor {
  v: number;
}

/** Any lexer token or table cell — shape varies, so access via loose record. */
type AnyToken = Record<string, unknown> & { type?: string };

function kindOf(type: string | undefined): SourceEntryKind {
  switch (type) {
    case 'text':
      return 'leaf';
    case 'codespan':
    case 'escape':
    case 'br':
    case 'html':
    case 'image':
    case 'code':
    case 'hr':
    case 'inlineMath':
    case 'blockMath':
    case 'space':
      return 'atomic';
    default:
      return 'container';
  }
}

function assignOffsets(
  tokens: AnyToken[],
  scopeRaw: string,
  scopeStart: number,
  cursor: Cursor,
  ctx: RenderContext,
): void {
  for (const token of tokens) {
    const raw = token.raw;
    if (typeof raw !== 'string') continue;
    const idx = scopeRaw.indexOf(raw, cursor.v);
    if (idx === -1) continue; // unresolved → render without annotation
    const start = scopeStart + idx;
    const end = start + raw.length;
    ctx.tokenMap.set(token, ctx.entries.length);
    ctx.entries.push({ start, end, kind: kindOf(token.type) });
    cursor.v = idx + raw.length;

    const childCursor: Cursor = { v: 0 };
    if (token.type === 'list' && Array.isArray(token.items)) {
      for (const item of token.items as AnyToken[]) {
        assignOffsets([item], raw, start, childCursor, ctx);
      }
    } else if (token.type === 'table') {
      // Table cells have no `raw` of their own: locate their inline children
      // directly inside the table's raw, and register a cell-level entry
      // spanning its children so `<td data-mdx>` selections stay granular.
      const cells: AnyToken[] = [
        ...((token.header as AnyToken[]) ?? []),
        ...((token.rows as AnyToken[][]) ?? []).flat(),
      ];
      for (const cell of cells) {
        const before = ctx.entries.length;
        assignOffsets((cell.tokens as AnyToken[]) ?? [], raw, start, childCursor, ctx);
        if (ctx.entries.length > before) {
          const first = ctx.entries[before];
          const last = ctx.entries[ctx.entries.length - 1];
          ctx.cellMap.set(cell, ctx.entries.length);
          ctx.entries.push({ start: first.start, end: last.end, kind: 'container' });
        }
      }
    } else if (Array.isArray(token.tokens)) {
      assignOffsets(token.tokens as AnyToken[], raw, start, childCursor, ctx);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Annotated renderer (delegates inner HTML to marked's default renderer)     */
/* -------------------------------------------------------------------------- */

function escapeHtml(text: string, encode = false): string {
  const escaped = text
    .replace(/&(?!(?:\w+|\w*;))/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return encode ? escaped.replace(/'/g, '&#39;') : escaped;
}

/** data-mdx attribute for a token, or '' when the token has no source entry. */
function attr(token: object): string {
  const idx = currentRender?.tokenMap.get(token);
  return idx === undefined ? '' : ` data-mdx="${idx}"`;
}

function wrap(token: object, html: string): string {
  const idx = currentRender?.tokenMap.get(token);
  return idx === undefined ? html : `<span data-mdx="${idx}">${html}</span>`;
}

const baseRenderer = new Renderer();

/** Call marked's default renderer method with untyped token shapes. */
function callBase(method: string, thisArg: unknown, token: unknown): string {
  const fn = (baseRenderer as unknown as Record<string, (this: unknown, t: unknown) => string>)[
    method
  ];
  return fn.call(thisArg, token);
}

const annotatedRenderer = {
  space(this: unknown, token: object) {
    return callBase('space', this, token);
  },
  code(this: unknown, token: object) {
    const html = callBase('code', this, token);
    return html.replace('<pre', `<pre${attr(token)}`);
  },
  blockquote(this: unknown, token: object) {
    const html = callBase('blockquote', this, token);
    return html.replace('<blockquote', `<blockquote${attr(token)}`);
  },
  html(this: unknown, token: AnyToken) {
    const html = callBase('html', this, token);
    // Block-level raw HTML cannot be safely wrapped in a span; annotate only
    // inline HTML (which lives inside a paragraph and gets a span wrapper).
    return token.block ? html : wrap(token, html);
  },
  heading(this: unknown, token: object) {
    const html = callBase('heading', this, token);
    return html.replace(/^<h(\d)/, `<h$1${attr(token)}`);
  },
  hr(this: unknown, token: object) {
    const html = callBase('hr', this, token);
    return html.replace('<hr', `<hr${attr(token)}`);
  },
  list(this: unknown, token: object) {
    const html = callBase('list', this, token);
    return html.replace(/^<(ul|ol)/, `<$1${attr(token)}`);
  },
  listitem(this: unknown, token: object) {
    const html = callBase('listitem', this, token);
    return html.replace('<li', `<li${attr(token)}`);
  },
  paragraph(this: unknown, token: object) {
    const html = callBase('paragraph', this, token);
    return html.replace('<p', `<p${attr(token)}`);
  },
  table(this: unknown, token: object) {
    const html = callBase('table', this, token);
    return html.replace('<table', `<table${attr(token)}`);
  },
  tablerow(this: unknown, token: object) {
    return callBase('tablerow', this, token);
  },
  tablecell(this: unknown, token: object) {
    const html = callBase('tablecell', this, token);
    const idx = currentRender?.cellMap.get(token);
    if (idx === undefined) return html;
    return html.replace(/^<(th|td)/, `<$1 data-mdx="${idx}"`);
  },
  strong(this: unknown, token: object) {
    return wrap(token, callBase('strong', this, token));
  },
  em(this: unknown, token: object) {
    return wrap(token, callBase('em', this, token));
  },
  codespan(this: unknown, token: object) {
    return wrap(token, callBase('codespan', this, token));
  },
  br(this: unknown, token: object) {
    return wrap(token, callBase('br', this, token));
  },
  del(this: unknown, token: object) {
    return wrap(token, callBase('del', this, token));
  },
  link(this: unknown, token: object) {
    return wrap(token, callBase('link', this, token));
  },
  image(this: unknown, token: object) {
    return wrap(token, callBase('image', this, token));
  },
  text(this: unknown, token: object) {
    return wrap(token, callBase('text', this, token));
  },
};

marked.use({
  gfm: true,
  breaks: true,
  extensions: [
    inlineMathExtension as TokenizerAndRendererExtension,
    blockMathExtension as TokenizerAndRendererExtension,
  ],
  renderer: annotatedRenderer as unknown as Partial<RendererObject>,
} as MarkedExtension);

/* -------------------------------------------------------------------------- */
/* Rendering + range resolution                                                */
/* -------------------------------------------------------------------------- */

export function renderMarkdownWithSourceMap(source: string): SourceMappedRender {
  const ctx: RenderContext = {
    entries: [],
    tokenMap: new WeakMap(),
    cellMap: new WeakMap(),
  };
  currentRender = ctx;
  try {
    const tokens = marked.lexer(source);
    assignOffsets(tokens as unknown as AnyToken[], source, 0, { v: 0 }, ctx);
    const html = marked.parser(tokens) as string;
    return {
      html,
      source,
      resolveRange: (root: HTMLElement, range: Range) =>
        resolveRangeToSource(source, ctx.entries, root, range),
    };
  } finally {
    currentRender = null;
  }
}

/* -------------------------------------------------------------------------- */
/* Range → source resolution                                                   */
/* -------------------------------------------------------------------------- */

function textLen(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue?.length ?? 0;
  return (node as Element).textContent?.length ?? 0;
}

/** Resolve a range boundary to the deepest text node on the correct side. */
function deepestTextPoint(
  node: Node,
  offset: number,
  direction: 'start' | 'end',
): { node: Node; offset: number } {
  if (node.nodeType === Node.TEXT_NODE) return { node, offset };
  const el = node as Element;
  const child = direction === 'start' ? el.childNodes[offset - 1] : el.childNodes[offset];
  if (child) {
    let cur: Node = child;
    while (cur.nodeType !== Node.TEXT_NODE && cur.hasChildNodes()) {
      cur = direction === 'start' ? cur.lastChild! : cur.firstChild!;
    }
    if (cur.nodeType === Node.TEXT_NODE) {
      return {
        node: cur,
        offset: direction === 'start' ? (cur.nodeValue?.length ?? 0) : 0,
      };
    }
    return { node: child, offset: 0 };
  }
  return { node: el, offset };
}

/** Nearest ancestor of `node` with data-mdx, staying inside `root`. */
function nearestAnnotated(root: HTMLElement, node: Node | null): HTMLElement | null {
  let el: Node | null = node;
  while (el && el !== root) {
    if (el.nodeType === Node.ELEMENT_NODE && (el as HTMLElement).hasAttribute('data-mdx')) {
      return el as HTMLElement;
    }
    el = el.parentNode;
  }
  return null;
}

/** Offset of the point (node, offset) within `el`'s text content, or null. */
function contentOffsetWithin(el: HTMLElement, node: Node, offset: number): number | null {
  let n: Node = node;
  let total: number;
  if (n.nodeType === Node.TEXT_NODE) {
    total = offset;
  } else {
    total = 0;
    const kids = (n as Element).childNodes;
    const limit = Math.max(0, Math.min(offset, kids.length));
    for (let i = 0; i < limit; i++) total += textLen(kids[i]);
  }
  while (n !== el) {
    const parent = n.parentNode;
    if (!parent) return null;
    let extra = 0;
    let sib = n.previousSibling;
    while (sib) {
      extra += textLen(sib);
      sib = sib.previousSibling;
    }
    total += extra;
    n = parent;
  }
  return total;
}

/** First/last non-whitespace text-node boundary points inside an element. */
function firstTextPoint(el: Element): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n: Node | null = walker.nextNode();
  while (n && (n.nodeValue ?? '').trim() === '') {
    n = walker.nextNode();
  }
  return n ? { node: n as Text, offset: 0 } : null;
}

function lastTextPoint(el: Element): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  let n: Node | null = walker.nextNode();
  while (n) {
    if ((n.nodeValue ?? '').trim() !== '') last = n as Text;
    n = walker.nextNode();
  }
  return last ? { node: last, offset: last.nodeValue?.length ?? 0 } : null;
}

/**
 * Compare two (node, offset) boundary points. Uses text-node-based collapsed
 * ranges because jsdom's `compareBoundaryPoints` mishandles element boundaries.
 */
function comparePoints(a: Node, ao: number, b: Node, bo: number): number {
  const ra = document.createRange();
  ra.setStart(a, ao);
  ra.setEnd(a, ao);
  const rb = document.createRange();
  rb.setStart(b, bo);
  rb.setEnd(b, bo);
  return ra.compareBoundaryPoints(Range.START_TO_START, rb);
}

/** Does `range` cover the element's entire rendered text content? */
function coversContent(range: Range, el: HTMLElement): boolean {
  const start = firstTextPoint(el);
  const end = lastTextPoint(el);
  if (!start || !end) {
    // Element without text content (image, hr): covered when its point is
    // inside the range.
    return range.isPointInRange(el, 0);
  }
  const rangeStart = deepestTextPoint(range.startContainer, range.startOffset, 'start');
  const rangeEnd = deepestTextPoint(range.endContainer, range.endOffset, 'end');
  return (
    comparePoints(rangeStart.node, rangeStart.offset, start.node, start.offset) <= 0 &&
    comparePoints(rangeEnd.node, rangeEnd.offset, end.node, end.offset) >= 0
  );
}

export function resolveRangeToSource(
  source: string,
  entries: SourceEntry[],
  root: HTMLElement,
  range: Range,
): string {
  const intervals: Array<[number, number]> = [];

  // (a) Every annotated element whose rendered content lies fully inside the
  // selection contributes its whole raw slice (containers included).
  const elements = root.querySelectorAll<HTMLElement>('[data-mdx]');
  for (const el of Array.from(elements)) {
    const idx = Number(el.dataset.mdx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= entries.length) continue;
    if (coversContent(range, el)) {
      intervals.push([entries[idx].start, entries[idx].end]);
    }
  }

  // (b) The two boundary elements: slice `leaf` entries by the endpoint's
  // offset inside them; `atomic`/`container` entries contribute fully.
  const startPt = deepestTextPoint(range.startContainer, range.startOffset, 'start');
  const endPt = deepestTextPoint(range.endContainer, range.endOffset, 'end');
  const startEl = nearestAnnotated(root, startPt.node);
  const endEl = nearestAnnotated(root, endPt.node);

  const entryOf = (el: HTMLElement | null): SourceEntry | null => {
    if (!el) return null;
    const idx = Number(el.dataset.mdx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= entries.length) return null;
    return entries[idx];
  };

  const addBoundary = (
    el: HTMLElement,
    entry: SourceEntry,
    pt: { node: Node; offset: number },
    side: 'start' | 'end',
  ) => {
    const off = contentOffsetWithin(el, pt.node, pt.offset);
    if (off === null) return;
    if (side === 'start') {
      if (off >= (el.textContent?.length ?? 0)) return;
      if (entry.kind === 'leaf') intervals.push([entry.start + off, entry.end]);
      else intervals.push([entry.start, entry.end]);
    } else {
      if (off <= 0) return;
      if (entry.kind === 'leaf') intervals.push([entry.start, entry.start + off]);
      else intervals.push([entry.start, entry.end]);
    }
  };

  const startEntry = entryOf(startEl);
  const endEntry = entryOf(endEl);
  if (startEl && endEl && startEl === endEl && startEntry && endEntry) {
    // Both endpoints inside the same annotated element: slice it once.
    const startOff = contentOffsetWithin(startEl, startPt.node, startPt.offset) ?? 0;
    const endOff = contentOffsetWithin(endEl, endPt.node, endPt.offset) ?? 0;
    if (startEntry.kind === 'leaf') {
      intervals.push([startEntry.start + startOff, startEntry.start + endOff]);
    } else {
      intervals.push([startEntry.start, startEntry.end]);
    }
  } else {
    if (startEl && startEntry) addBoundary(startEl, startEntry, startPt, 'start');
    if (endEl && endEntry) addBoundary(endEl, endEntry, endPt, 'end');
  }

  if (intervals.length === 0) {
    // No annotated element intersects the selection (e.g. raw HTML blocks) —
    // fall back to the rendered text, the previous behavior.
    return range.toString().trim();
  }

  let min = Infinity;
  let max = -Infinity;
  for (const [s, e] of intervals) {
    if (s < min) min = s;
    if (e > max) max = e;
  }
  return source.slice(min, max).trim();
}
