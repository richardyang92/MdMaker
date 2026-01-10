/**
 * @建议菜单组件
 * 当用户输入@时显示，提供可引用的选项（选区、光标、文档）
 */

import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { AtOption } from './useAtSyntax';

interface AtSuggestionsMenuProps {
  position: { top: number; left: number };
  options: AtOption[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onSelectOption: (option: AtOption) => void;
  onClose: () => void;
  editorRef: React.RefObject<any>;
}

export const AtSuggestionsMenu: React.FC<AtSuggestionsMenuProps> = ({
  position,
  options,
  selectedIndex,
  setSelectedIndex,
  onSelectOption,
  onClose,
  editorRef
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  // 获取选区状态
  const getHasSelection = () => {
    if (!editorRef.current) return false;
    const selection = editorRef.current.getSelection();
    return selection && !selection.isEmpty();
  };

  const getSelectionLineRange = (): { start: number; end: number } | null => {
    if (!editorRef.current) return null;
    const selection = editorRef.current.getSelection();
    if (!selection || selection.isEmpty()) return null;

    const startPosition = selection.getStartPosition();
    const endPosition = selection.getEndPosition();

    return {
      start: startPosition.lineNumber,
      end: endPosition.lineNumber
    };
  };

  const getHasDocument = () => {
    if (!editorRef.current) return false;
    const model = editorRef.current.getModel();
    return model && model.getValue().trim().length > 0;
  };

  const hasSelection = getHasSelection();
  const hasDocument = getHasDocument();
  const selectionLineRange = getSelectionLineRange();

  // 获取选区行号显示文本
  const getSelectionLineText = () => {
    if (!selectionLineRange) return '';
    if (selectionLineRange.start === selectionLineRange.end) {
      return `行 ${selectionLineRange.start}`;
    }
    return `行 ${selectionLineRange.start}-${selectionLineRange.end}`;
  };

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      id="at-suggestions-menu"
      className="dropdown-menu shadow-lg"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: '280px',
        maxHeight: '300px',
        overflowY: 'auto',
        zIndex: 9999,
        pointerEvents: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-2" style={{ borderRadius: 'var(--radius-md)' }}>
        <div className="px-3 py-2 text-xs" style={{
          color: 'var(--text-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '4px'
        }}>
          引用选项
        </div>
        {options.map((option, index) => {
          const isDisabled =
            (option.id === 'selection' && !hasSelection) ||
            (option.id === 'document' && !hasDocument);

          // 获取完整的描述文本
          const getDescriptionText = () => {
            if (option.id === 'selection' && !hasSelection) {
              return `${option.description} (当前无选区)`;
            }
            if (option.id === 'document' && !hasDocument) {
              return `${option.description} (文档为空)`;
            }
            return option.description;
          };

          return (
            <button
              key={option.id}
              type="button"
              disabled={isDisabled}
              className={`w-full px-4 py-3 text-sm transition-all duration-fast ease-out dropdown-item`}
              style={{
                backgroundColor: index === selectedIndex
                  ? 'var(--accent-light)'
                  : 'transparent',
                color: isDisabled
                  ? 'var(--text-tertiary)'
                  : index === selectedIndex
                    ? 'var(--accent-primary)'
                    : 'var(--text-primary)',
                borderLeft: index === selectedIndex
                  ? '3px solid var(--accent-primary)'
                  : '3px solid transparent',
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDisabled) {
                  onSelectOption(option);
                }
              }}
              onMouseEnter={() => {
                if (!isDisabled) {
                  setSelectedIndex(index);
                }
              }}
            >
              <span style={{ fontSize: '18px' }}>{option.icon}</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div className="font-medium" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {option.label}
                  {option.id === 'selection' && hasSelection && selectionLineRange && (
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--accent-primary)',
                      color: 'var(--accent-text)',
                      fontWeight: 'normal'
                    }}>
                      {getSelectionLineText()}
                    </span>
                  )}
                </div>
                <div className="text-xs" style={{
                  color: isDisabled
                    ? 'var(--text-tertiary)'
                    : 'var(--text-secondary)',
                  marginTop: '2px'
                }}>
                  {getDescriptionText()}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
};
