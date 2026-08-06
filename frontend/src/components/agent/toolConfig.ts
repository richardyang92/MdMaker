/**
 * Agent 工具名 → 显示信息的映射。
 * 用于活动流 UI 把后端工具名（如 find_replace）渲染成人类可读的中文 + emoji。
 */
export interface ToolDisplay {
  /** emoji 图标 */
  icon: string;
  /** 中文显示名 */
  label: string;
}

const TOOL_CONFIG: Record<string, ToolDisplay> = {
  get_section: { icon: '📖', label: '读取章节' },
  get_document_outline: { icon: '📋', label: '文档大纲' },
  insert_text: { icon: '✏️', label: '插入文本' },
  replace_section: { icon: '🔄', label: '替换章节' },
  replace_range: { icon: '🔄', label: '替换片段' },
  delete_range: { icon: '🗑️', label: '删除片段' },
  find_replace: { icon: '🔁', label: '批量替换' },
  set_title: { icon: '🏷️', label: '设置标题' },
};

/** 获取工具显示信息；未知工具回退为通用样式。 */
export function getToolDisplay(name: string): ToolDisplay {
  return TOOL_CONFIG[name] ?? { icon: '⚙️', label: name };
}
