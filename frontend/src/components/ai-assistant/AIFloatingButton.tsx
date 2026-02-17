import React, { useRef } from 'react';

interface AIFloatingButtonProps {
  onClick: () => void;
  isStreaming?: boolean;
  hasUnread?: boolean;
  children?: React.ReactNode;
}

export const AIFloatingButton: React.FC<AIFloatingButtonProps> = ({
  onClick,
  isStreaming = false,
  hasUnread = false,
  children
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (onClick) onClick();
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-xl hover-lift z-[9999] flex items-center justify-center transition-all duration-300 ${
          isStreaming ? 'ai-fab-pulse' : ''
        }`}
        style={{
          background: 'linear-gradient(135deg, var(--ai-accent), var(--ai-hover))',
          boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)'
        }}
        title="AI助手 (Ctrl+Shift+A)"
      >
        {/* AI图标 */}
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>

        {/* 未读/流式响应指示器 */}
        {(hasUnread || isStreaming) && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 animate-pulse" />
        )}
      </button>

      {/* 子元素（AI助手面板）传递按钮ref */}
      {children && React.cloneElement(children as React.ReactElement, {
        triggerRef: buttonRef
      })}
    </>
  );
};

export default AIFloatingButton;
