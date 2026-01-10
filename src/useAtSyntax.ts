/**
 * @语法处理Hook
 * 管理@语法的所有交互逻辑：检测、菜单显示、键盘导航、选项应用
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { shouldTriggerAtSuggestions } from './AtSyntaxParser';

interface UseAtSyntaxOptions {
  onApplyMention?: (mentionType: string) => void;
  editorRef: React.RefObject<any>;
}

interface AtMenuPosition {
  top: number;
  left: number;
}

export interface AtOption {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export function useAtSyntax({ onApplyMention, editorRef }: UseAtSyntaxOptions) {
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [atMenuPosition, setAtMenuPosition] = useState<AtMenuPosition>({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 可用的@选项
  const atOptions: AtOption[] = [
    { id: 'selection', label: '选区文本', description: '引用当前选中的文本', icon: '📋' },
    { id: 'cursor', label: '光标位置', description: '引用光标周围的上下文', icon: '📍' },
    { id: 'document', label: '完整文档', description: '引用整个文档内容', icon: '📄' }
  ];

  /**
   * 检测@符号并显示菜单
   */
  const handleInputChange = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const text = textarea.value;
    const cursorPosition = textarea.selectionStart;

    if (shouldTriggerAtSuggestions(text, cursorPosition)) {
      // 计算菜单位置（在光标下方）
      const rect = textarea.getBoundingClientRect();

      // 获取光标在textarea中的坐标
      // 使用一个简单的近似方法：根据行数和当前行长度计算
      const textBeforeCursor = text.substring(0, cursorPosition);
      const lines = textBeforeCursor.split('\n');
      const currentLineIndex = lines.length - 1;
      const currentLineLength = lines[lines.length - 1].length;

      // 假设的行高和字符宽度（可以根据实际样式调整）
      const lineHeight = 21; // textarea的行高
      const charWidth = 8.5; // 平均字符宽度
      const menuHeight = 180; // 菜单的预估高度

      // 计算相对于视口的位置
      const scrollTop = textarea.scrollTop;
      const scrollLeft = textarea.scrollLeft;

      // 向上弹出菜单：在光标上方显示
      const top = rect.top + window.scrollY + (currentLineIndex * lineHeight) - scrollTop - menuHeight - 8;
      const left = rect.left + window.scrollX + (currentLineLength * charWidth) - scrollLeft + 16;

      setAtMenuPosition({ top, left });
      setShowAtMenu(true);
      setSelectedIndex(0);
    } else {
      setShowAtMenu(false);
    }
  }, []);

  /**
   * 获取选区的行号范围
   */
  const getSelectionLineRange = useCallback((): { start: number; end: number } | null => {
    if (!editorRef.current) return null;

    const selection = editorRef.current.getSelection();
    if (!selection || selection.isEmpty()) return null;

    const model = editorRef.current.getModel();
    if (!model) return null;

    const startPosition = selection.getStartPosition();
    const endPosition = selection.getEndPosition();

    return {
      start: startPosition.lineNumber,
      end: endPosition.lineNumber
    };
  }, [editorRef]);

  /**
   * 应用选中的@选项
   */
  const applyAtOption = useCallback((option: AtOption) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const text = textarea.value;
    const cursorPosition = textarea.selectionStart;

    // 找到@符号的位置（光标前的最后一个@）
    const beforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) return;

    // 构建插入的文本
    let mentionText = `@${option.id}`;

    // 如果是选区选项，添加行号信息
    if (option.id === 'selection') {
      const lineRange = getSelectionLineRange();
      if (lineRange) {
        if (lineRange.start === lineRange.end) {
          mentionText = `@selection#L${lineRange.start}`;
        } else {
          mentionText = `@selection#L${lineRange.start}-${lineRange.end}`;
        }
      }
    }

    // 将@替换为@option (带行号)
    const beforeAt = text.substring(0, lastAtIndex);
    const afterAt = text.substring(cursorPosition);
    const newText = beforeAt + mentionText + afterAt;

    // 更新textarea值
    textarea.value = newText;

    // 创建并触发input事件，确保React的onChange被调用
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);

    // 设置光标位置到mentionText后面
    const newCursorPosition = lastAtIndex + mentionText.length;
    textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    textarea.focus();

    setShowAtMenu(false);

    if (onApplyMention) {
      onApplyMention(option.id);
    }
  }, [onApplyMention, getSelectionLineRange]);

  /**
   * 键盘导航处理
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showAtMenu) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % atOptions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + atOptions.length) % atOptions.length);
        break;
      case 'Enter':
        e.preventDefault();
        applyAtOption(atOptions[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setShowAtMenu(false);
        break;
      case 'Tab':
        e.preventDefault();
        applyAtOption(atOptions[selectedIndex]);
        break;
    }
  }, [showAtMenu, selectedIndex, applyAtOption, atOptions]);

  /**
   * 点击外部关闭菜单
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const menu = document.getElementById('at-suggestions-menu');
      if (menu && !menu.contains(target) && !textareaRef.current?.contains(target)) {
        setShowAtMenu(false);
      }
    };

    if (showAtMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAtMenu]);

  return {
    textareaRef,
    showAtMenu,
    atMenuPosition,
    atOptions,
    selectedIndex,
    setSelectedIndex,
    handleInputChange,
    handleKeyDown,
    applyAtOption,
    setShowAtMenu
  };
}
