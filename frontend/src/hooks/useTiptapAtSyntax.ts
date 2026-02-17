/**
 * Tiptap @语法处理Hook
 * 专为Tiptap编辑器设计的@建议菜单逻辑
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';

export interface AtOption {
  id: string;
  label: string;
  description: string;
  icon: string;
}

interface AtMenuPosition {
  top: number;
  left: number;
}

interface UseTiptapAtSyntaxOptions {
  editor: Editor | null;
  onApplyMention?: (mentionType: string) => void;
  hasSelection?: boolean;
}

// 默认的@选项
const DEFAULT_AT_OPTIONS: AtOption[] = [
  { id: 'selection', label: '选区文本', description: '引用当前选中的文本', icon: '📋' },
  { id: 'cursor', label: '光标位置', description: '引用光标周围的上下文', icon: '📍' },
  { id: 'document', label: '完整文档', description: '引用整个文档内容', icon: '📄' }
];

export function useTiptapAtSyntax({ editor, onApplyMention, hasSelection = false }: UseTiptapAtSyntaxOptions) {
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [atMenuPosition, setAtMenuPosition] = useState<AtMenuPosition>({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [atTriggerPosition, setAtTriggerPosition] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 过滤选项（根据是否有选区）
  const atOptions = DEFAULT_AT_OPTIONS;

  // 检测@符号输入
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const text = editor.getText();
      const cursorPos = editor.state.selection.from;

      // 获取光标前的文本
      const textBeforeCursor = text.substring(0, cursorPos - 1); // -1 因为Tiptap的from是1-based

      // 检查是否刚输入了@
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        // 检查@后面是否只有空格或没有内容
        const afterAt = textBeforeCursor.substring(lastAtIndex + 1);

        // 检查这个@是否紧跟着已完成的引用标记（如 @selection、@cursor、@document）
        // 如果@后面紧跟着这些关键词，说明是已完成的引用，不应该触发菜单
        const completedMentionPattern = /^(selection|cursor|document)(?:\s|$)/;
        if (completedMentionPattern.test(afterAt)) {
          setShowAtMenu(false);
          setAtTriggerPosition(null);
          return;
        }

        // 如果@后面没有换行符或其他@，则显示菜单
        if (!afterAt.includes('\n') && !afterAt.includes('@')) {
          // 获取编辑器容器的位置
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            // 简单的位置计算：在输入框上方
            setAtMenuPosition({
              top: rect.top - 200,
              left: rect.left + 20
            });
          }
          setAtTriggerPosition(lastAtIndex);
          setShowAtMenu(true);
          setSelectedIndex(0);
          return;
        }
      }

      setShowAtMenu(false);
      setAtTriggerPosition(null);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  // 应用选中的@选项
  const applyAtOption = useCallback((option: AtOption) => {
    if (!editor || atTriggerPosition === null) return;

    const text = editor.getText();
    const cursorPos = editor.state.selection.from;

    // 找到@的位置
    const beforeCursor = text.substring(0, cursorPos - 1);
    const lastAtIndex = beforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) return;

    // 构建插入的文本
    let mentionText = `@${option.id} `;

    // 计算Tiptap中的位置（1-based）
    const from = lastAtIndex + 1; // +1 转换为1-based
    const to = cursorPos;

    // 删除@及其后面的内容（到当前光标）
    editor.chain()
      .focus()
      .setTextSelection({ from, to })
      .deleteSelection()
      .insertContent(mentionText)
      .run();

    setShowAtMenu(false);
    setAtTriggerPosition(null);

    if (onApplyMention) {
      onApplyMention(option.id);
    }
  }, [editor, atTriggerPosition, onApplyMention]);

  // 键盘导航处理
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showAtMenu) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (prev + 1) % atOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => (prev - 1 + atOptions.length) % atOptions.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        applyAtOption(atOptions[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        setShowAtMenu(false);
        break;
    }
  }, [showAtMenu, selectedIndex, applyAtOption, atOptions]);

  // 添加键盘事件监听
  useEffect(() => {
    if (showAtMenu) {
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [showAtMenu, handleKeyDown]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const menu = document.getElementById('tiptap-at-menu');
      if (menu && !menu.contains(target) && !containerRef.current?.contains(target)) {
        setShowAtMenu(false);
      }
    };

    if (showAtMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAtMenu]);

  return {
    containerRef,
    showAtMenu,
    atMenuPosition,
    atOptions,
    selectedIndex,
    setSelectedIndex,
    applyAtOption,
    setShowAtMenu,
    hasSelection
  };
}
