import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderMarkdownWithSourceMap,
  resolveRangeToSource,
  type SourceEntry,
} from './markdownSourceMap';

/**
 * Render markdown, inject the annotated HTML into jsdom, and return helpers to
 * select a range between two text substrings and resolve it back to source.
 */
function setup(source: string) {
  const rendered = renderMarkdownWithSourceMap(source);
  const root = document.createElement('div');
  root.innerHTML = rendered.html;
  document.body.appendChild(root);
  const findText = (substr: string): Text => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node.textContent?.includes(substr)) return node as Text;
      node = walker.nextNode();
    }
    throw new Error(`text node not found: ${substr}`);
  };
  const select = (startSub: string, endSub: string): string => {
    const startNode = findText(startSub);
    const endNode = findText(endSub);
    const range = document.createRange();
    range.setStart(startNode, startNode.textContent!.indexOf(startSub));
    range.setEnd(endNode, endNode.textContent!.indexOf(endSub) + endSub.length);
    return rendered.resolveRange(root, range);
  };
  return { root, select };
}

describe('renderMarkdownWithSourceMap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.getSelection()?.removeAllRanges();
  });

  it('returns the whole heading raw source (with #) for a heading selection', () => {
    const { select } = setup('# 标题\n\n正文内容');
    expect(select('标题', '标题')).toBe('# 标题');
  });

  it('returns the raw bold syntax when the whole bold phrase is selected', () => {
    const { select } = setup('这是 **粗体** 文本');
    expect(select('粗体', '粗体')).toBe('**粗体**');
  });

  it('returns the raw list item (with marker) for a list item selection', () => {
    const { select } = setup('- 项目一\n- 项目二\n');
    expect(select('项目一', '项目一')).toBe('- 项目一');
  });

  it('returns both list items with markers for a cross-item selection', () => {
    const { select } = setup('- 项目一\n- 项目二\n');
    expect(select('项目一', '项目二')).toBe('- 项目一\n- 项目二');
  });

  it('returns the full fenced code block for a selection inside code', () => {
    const { select } = setup('```js\nconst x = 1;\n```\n');
    expect(select('const x', 'const x')).toBe('```js\nconst x = 1;\n```');
  });

  it('returns the raw inline math source for a formula selection', () => {
    const { select } = setup('质能方程：$E=mc^2$。');
    expect(select('E=mc', 'mc^2')).toBe('$E=mc^2$');
  });

  it('preserves blank lines between blocks in a cross-paragraph selection', () => {
    const { select } = setup('第一段。\n\n第二段。\n');
    expect(select('第一段', '第二段。')).toBe('第一段。\n\n第二段。');
  });

  it('slices plain text leaves by selection offsets', () => {
    const { select } = setup('一二三四五六七八');
    expect(select('三四五', '三四五')).toBe('三四五');
  });

  it('returns a single cell value for a cell selection', () => {
    const { select } = setup('| 张三 | 25 |\n| --- | -- |\n| 李四 | 30 |\n');
    expect(select('李四', '李四')).toBe('李四');
  });

  it('returns the full table raw source when the whole table is selected', () => {
    const { select } = setup('| 张三 | 25 |\n| --- | -- |\n| 李四 | 30 |\n');
    expect(select('张三', '30')).toBe('| 张三 | 25 |\n| --- | -- |\n| 李四 | 30 |');
  });

  it('falls back to rendered text when nothing annotated intersects', () => {
    const { root, select } = setup('<div>原始HTML块</div>');
    const fallback = select('原始HTML块', '原始HTML块');
    expect(fallback).toBe('原始HTML块');
    expect(root.innerHTML).toContain('原始HTML块');
  });
});

describe('resolveRangeToSource (hand-built DOM)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('unions fully covered intervals and boundary slices', () => {
    const source = 'ab cdef gh';
    // entries: "ab" [0,2) leaf, "cdef" [3,7) leaf, "gh" [8,10) leaf
    const entries: SourceEntry[] = [
      { start: 0, end: 2, kind: 'leaf' },
      { start: 3, end: 7, kind: 'leaf' },
      { start: 8, end: 10, kind: 'leaf' },
    ];
    const root = document.createElement('div');
    root.innerHTML = '<span data-mdx="0">ab</span> <span data-mdx="1">cdef</span> <span data-mdx="2">gh</span>';
    document.body.appendChild(root);

    const range = document.createRange();
    const mid = root.querySelector('[data-mdx="1"]')!.firstChild as Text;
    range.setStart(mid, 1); // "def"
    range.setEnd(mid, 3);
    expect(resolveRangeToSource(source, entries, root, range)).toBe('de');
  });

  it('treats atomic entries as whole tokens when partially selected', () => {
    const source = '前 `code` 后';
    const entries: SourceEntry[] = [
      { start: 0, end: 1, kind: 'leaf' },
      { start: 2, end: 8, kind: 'atomic' },
      { start: 9, end: 10, kind: 'leaf' },
    ];
    const root = document.createElement('div');
    root.innerHTML = '<span data-mdx="0">前</span> <span data-mdx="1">code</span> <span data-mdx="2">后</span>';
    document.body.appendChild(root);

    const range = document.createRange();
    const code = root.querySelector('[data-mdx="1"]')!.firstChild as Text;
    range.setStart(code, 1);
    range.setEnd(code, 2);
    expect(resolveRangeToSource(source, entries, root, range)).toBe('`code`');
  });
});
