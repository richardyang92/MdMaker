/**
 * @语法解析工具
 * 用于解析和处理输入框中的@标记（@selection, @cursor, @document）
 */

// @语法相关类型定义
export interface AtMention {
  type: 'selection' | 'cursor' | 'document';
  startIndex: number;
  endIndex: number;
  originalText: string;
  lineRange?: { start: number; end: number }; // 行号范围
}

export interface ParsedAtSyntax {
  text: string;
  mentions: AtMention[];
}

export interface SelectionInfo {
  start: number;
  end: number;
  text: string;
}

/**
 * 检测文本中是否有@符号触发
 * @param text 当前输入文本
 * @param cursorPosition 光标位置
 * @returns 是否应该触发建议菜单
 */
export function shouldTriggerAtSuggestions(
  text: string,
  cursorPosition: number
): boolean {
  // 获取光标前的文本
  const beforeCursor = text.substring(0, cursorPosition);

  // 检查最后一个字符是否是@
  const lastChar = beforeCursor.trim().slice(-1);
  return lastChar === '@';
}

/**
 * 解析文本中的所有@标记
 * @param text 包含@标记的文本
 * @returns 解析结果
 */
export function parseAtSyntax(text: string): ParsedAtSyntax {
  const mentions: AtMention[] = [];
  let processedText = text;

  // 匹配 @selection#L4-7, @cursor, @document 等模式
  // 支持 @selection#L4 (单行) 或 @selection#L4-7 (多行范围)
  const atPattern = /@(selection|cursor|document)(?:#L(\d+(?:-\d+)?))?/g;
  let match;

  while ((match = atPattern.exec(text)) !== null) {
    const mention: AtMention = {
      type: match[1] as 'selection' | 'cursor' | 'document',
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      originalText: match[0]
    };

    // 解析行号范围
    if (match[2]) {
      const lineRange = match[2];
      if (lineRange.includes('-')) {
        // 多行范围: L4-7
        const [start, end] = lineRange.split('-').map(Number);
        mention.lineRange = { start, end };
      } else {
        // 单行: L4
        mention.lineRange = { start: Number(lineRange), end: Number(lineRange) };
      }
    }

    mentions.push(mention);
  }

  return {
    text: processedText,
    mentions
  };
}

/**
 * 将@标记替换为实际内容
 * @param text 包含@标记的文本
 * @param selection 当前选区内容
 * @param documentContent 完整文档内容
 * @param cursorPosition 光标位置
 * @returns 替换后的文本
 */
export function replaceAtMentions(
  text: string,
  selection: SelectionInfo | null,
  documentContent: string,
  cursorPosition: number
): string {
  return text
    .replace(/@selection(?:#L(\d+(?:-\d+)?))?/g, (_, lineRange) => {
      if (selection && selection.text) {
        // 截断过长的选区内容（最多500字符）
        const truncatedText =
          selection.text.length > 500
            ? selection.text.substring(0, 500) + '...(已截断)'
            : selection.text;

        // 如果有行号信息，添加到引用标题中
        let lineInfo = '';
        if (lineRange) {
          if (lineRange.includes('-')) {
            lineInfo = ` (行 ${lineRange})`;
          } else {
            lineInfo = ` (行 ${lineRange})`;
          }
        }

        return `> [选区引用${lineInfo}]\n${truncatedText}\n`;
      }
      return '[无选区]';
    })
    .replace(/@cursor/g, () => {
      // 返回光标周围的内容
      const contextLength = 100;
      const start = Math.max(0, cursorPosition - contextLength);
      const end = Math.min(documentContent.length, cursorPosition + contextLength);
      const context = documentContent.substring(start, end);
      return `> [光标位置上下文]\n${context}\n`;
    })
    .replace(/@document/g, () => {
      // 截断过长的文档（最多1000字符）
      const truncatedDoc =
        documentContent.length > 1000
          ? documentContent.substring(0, 1000) + '...(已截断)'
          : documentContent;
      return `> [完整文档]\n${truncatedDoc}\n`;
    });
}
