import { describe, it, expect } from 'vitest';
import { renderChatMarkdown } from './chatMarkdown';

describe('renderChatMarkdown', () => {
  it('renders inline formatting (bold / italic / code)', () => {
    const html = renderChatMarkdown('这是 **粗体** 和 *斜体* 以及 `代码`。');
    expect(html).toContain('<strong>粗体</strong>');
    expect(html).toContain('<em>斜体</em>');
    expect(html).toContain('<code>代码</code>');
  });

  it('renders headings, lists and fenced code blocks', () => {
    const html = renderChatMarkdown(
      '# 标题\n\n- 项目一\n- 项目二\n\n```js\nconst x = 1;\n```',
    );
    expect(html).toContain('<h1');
    expect(html).toContain('项目一');
    expect(html).toContain('<pre><code');
  });

  it('renders GFM tables', () => {
    const html = renderChatMarkdown('| 姓名 | 年龄 |\n| --- | --- |\n| 张三 | 25 |');
    expect(html).toContain('<table>');
    expect(html).toContain('张三');
  });

  it('renders GFM task lists with checkboxes', () => {
    const html = renderChatMarkdown('- [x] 完成\n- [ ] 未完成');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('renders inline and block math with KaTeX', () => {
    const html = renderChatMarkdown('行内 $E=mc^2$ 公式\n\n$$\n\\int_0^1 x dx\n$$');
    expect(html).toContain('katex');
    expect(html).toContain('katex-display');
  });

  it('escapes raw HTML instead of rendering it', () => {
    const html = renderChatMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('strips dangerous link and image URLs', () => {
    const html = renderChatMarkdown('[x](javascript:alert(1)) ![i](data:image/png;base64,xxx)');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:image');
  });

  it('keeps safe http(s) links intact', () => {
    const html = renderChatMarkdown('[链接](https://example.com)');
    expect(html).toContain('href="https://example.com"');
  });

  it('converts single newlines into line breaks (chat-style)', () => {
    const html = renderChatMarkdown('第一行\n第二行');
    expect(html).toContain('<br');
  });

  it('returns an empty string for blank input', () => {
    expect(renderChatMarkdown('')).toBe('');
    expect(renderChatMarkdown('   \n ')).toBe('');
  });
});
