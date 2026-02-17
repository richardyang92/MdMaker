/**
 * Tiptap @建议菜单组件
 * 专为Tiptap编辑器设计的轻量级建议菜单
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { AtOption } from '../../hooks/useTiptapAtSyntax';

interface TiptapAtMenuProps {
  position: { top: number; left: number };
  options: AtOption[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onSelectOption: (option: AtOption) => void;
  hasSelection: boolean;
}

export const TiptapAtMenu: React.FC<TiptapAtMenuProps> = ({
  position,
  options,
  selectedIndex,
  setSelectedIndex,
  onSelectOption,
  hasSelection
}) => {
  // 检查选项是否可用
  const isOptionDisabled = (option: AtOption) => {
    return option.id === 'selection' && !hasSelection;
  };

  return ReactDOM.createPortal(
    <div
      id="tiptap-at-menu"
      className="dropdown-menu shadow-lg"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: '260px',
        maxHeight: '280px',
        overflowY: 'auto',
        zIndex: 9999,
        pointerEvents: 'auto',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-2">
        <div className="px-3 py-2 text-xs font-medium" style={{
          color: 'var(--text-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>💡</span>
          输入 @ 引用内容
        </div>
        {options.map((option, index) => {
          const isDisabled = isOptionDisabled(option);

          return (
            <button
              key={option.id}
              type="button"
              disabled={isDisabled}
              className="w-full px-3 py-2.5 text-sm transition-all duration-fast"
              style={{
                backgroundColor: index === selectedIndex
                  ? 'var(--ai-light)'
                  : 'transparent',
                color: isDisabled
                  ? 'var(--text-tertiary)'
                  : index === selectedIndex
                    ? 'var(--ai-accent)'
                    : 'var(--text-primary)',
                borderLeft: index === selectedIndex
                  ? '3px solid var(--ai-accent)'
                  : '3px solid transparent',
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
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
                <div className="font-medium" style={{ fontSize: '13px' }}>
                  {option.label}
                  {option.id === 'selection' && hasSelection && (
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      marginLeft: '6px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--ai-accent)',
                      color: 'white',
                      fontWeight: 'normal'
                    }}>
                      已选
                    </span>
                  )}
                </div>
                <div className="text-xs" style={{
                  color: isDisabled
                    ? 'var(--text-tertiary)'
                    : 'var(--text-secondary)',
                  marginTop: '2px'
                }}>
                  {isDisabled && option.id === 'selection'
                    ? '请先在编辑器中选择文本'
                    : option.description}
                </div>
              </div>
            </button>
          );
        })}
        <div className="px-3 py-2 text-xs" style={{
          color: 'var(--text-tertiary)',
          borderTop: '1px solid var(--border-color)',
          marginTop: '4px'
        }}>
          <span style={{ opacity: 0.7 }}>↑↓ 导航 · Enter 选择 · Esc 关闭</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TiptapAtMenu;
