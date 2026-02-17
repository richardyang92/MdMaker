import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import './TiptapInput.css';
import { useTiptapAtSyntax } from '../../hooks/useTiptapAtSyntax';
import { TiptapAtMenu } from './TiptapAtMenu';

interface TiptapInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  hasSelection?: boolean;
  onApplyMention?: (mentionType: string) => void;
}

export const TiptapInput: React.FC<TiptapInputProps> = ({
  value,
  onChange,
  onSend,
  placeholder = '输入消息... Enter发送 Shift+Enter换行',
  disabled = false,
  hasSelection = false,
  onApplyMention
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        horizontalRule: false,
        heading: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getText());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });

  // @语法Hook
  const atSyntax = useTiptapAtSyntax({
    editor,
    onApplyMention,
    hasSelection
  });

  // 当外部value变化时，同步到编辑器
  useEffect(() => {
    if (editor && editor.getText() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 如果@菜单显示中，让hook处理键盘事件
    if (atSyntax.showAtMenu) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
        return; // 让hook的全局事件处理器处理
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  }, [value, disabled, onSend, atSyntax.showAtMenu]);

  if (!editor) {
    return null;
  }

  return (
    <div ref={atSyntax.containerRef} className="tiptap-input-container">
      <EditorContent
        editor={editor}
        onKeyDown={handleKeyDown}
      />
      {/* @建议菜单 */}
      {atSyntax.showAtMenu && (
        <TiptapAtMenu
          position={atSyntax.atMenuPosition}
          options={atSyntax.atOptions}
          selectedIndex={atSyntax.selectedIndex}
          setSelectedIndex={atSyntax.setSelectedIndex}
          onSelectOption={atSyntax.applyAtOption}
          hasSelection={hasSelection}
        />
      )}
    </div>
  );
};

export default TiptapInput;
