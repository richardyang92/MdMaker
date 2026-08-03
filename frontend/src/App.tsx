import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { marked } from 'marked';
import MessageItem from './MessageItem';
import TreeDemo from './TreeDemo';
import logo from '/logo.svg';
import { generateSystemMessage } from './promptTemplates';
import { useAtSyntax } from './useAtSyntax';
// import { AtSuggestionsMenu } from './AtSuggestionsMenu';
import { replaceAtMentions } from './AtSyntaxParser';
import { AIAssistantDrawer } from './components/ai-assistant/AIAssistantDrawer';
import { AIFloatingButton } from './components/ai-assistant/AIFloatingButton';
import { TiptapInput } from './components/ai-assistant/TiptapInput';
import { EmptyView } from './components/ai-assistant/EmptyView';
import { CodeMirrorEditor, CodeMirrorEditorRef } from './components/editor/CodeMirrorEditor';
import { QuickActions, QuickAction } from './components/ai-assistant/QuickActions';
import { loadConfigFromStorage, saveConfigToStorage } from './components/ai-assistant/SettingsPanel';
import { aiApi } from './services/api/aiApi';
import type { ChatContext, ProviderInfo } from './services/types/ai';
import { useAgentChat } from './hooks/useAgentChat';
import { AgentPanel } from './components/agent/AgentPanel';
import { agentApi } from './services/api/agentApi';

// 扩展消息接口，添加文档快照支持
interface Message {
  role: string;
  content: string;
  id: string;
  documentSnapshot?: string; // 发送消息前的文档快照
}

// 自定义主题下拉组件
const CustomThemeDropdown: React.FC<{
  theme: 'light' | 'dark' | 'eye-protect';
  setTheme: (theme: 'light' | 'dark' | 'eye-protect') => void;
}> = ({ theme, setTheme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);

  // 主题选项
  const themeOptions = [
    { value: 'light', label: '默认主题' },
    { value: 'dark', label: '深色主题' },
    { value: 'eye-protect', label: '护眼主题' },
  ];

  // 获取当前选中主题的标签
  const currentThemeLabel = themeOptions.find(option => option.value === theme)?.label || '默认主题';

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 检查点击是否在触发按钮或下拉菜单内
      const clickedInButton = dropdownRef.current && dropdownRef.current.contains(event.target as Node);
      const clickedInMenu = dropdownMenuRef.current && dropdownMenuRef.current.contains(event.target as Node);

      if (!clickedInButton && !clickedInMenu) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="w-full px-4 py-1 text-xs rounded-md shadow-sm flex items-center justify-center hover-lift transition-all duration-fast ease-out"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)'
        }}
        onClick={() => {
          if (dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            setDropdownPosition({
              top: rect.bottom,
              left: rect.left,
              width: rect.width
            });
          }
          setIsOpen(!isOpen);
        }}
      >
        <div className="flex items-center">
          <span className="mr-2">{currentThemeLabel}</span>
          <svg className={`fill-current h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </button>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={dropdownMenuRef}
          onClick={(e) => {
            console.log('Dropdown clicked, option.value:', e.currentTarget);
          }}
          className="dropdown-menu shadow-lg"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 9999,
            pointerEvents: 'auto'
          }}>
          <div className="py-1" style={{ borderRadius: 'var(--radius-md)' }}>
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="w-full px-4 py-2 text-xs text-center transition-all duration-fast ease-out dropdown-item first:rounded-t-md last:rounded-b-md"
                style={{
                  backgroundColor: theme === option.value ? 'var(--accent-primary)' : 'transparent',
                  color: theme === option.value ? 'var(--accent-text)' : 'var(--text-primary)'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Option clicked:', option.value, setTheme);
                  setTheme(option.value as any);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

function App() {
  // 主题状态
  const [theme, setTheme] = useState<'light' | 'dark' | 'eye-protect'>('light');

  // 后端 providers 状态
  const [backendProviders, setBackendProviders] = useState<Record<string, ProviderInfo>>({});

  // 历史记录状态，用于实现撤回功能
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [markdown, setMarkdown] = useState(`# Hello Markdown

这是一个支持完整Markdown语法和LaTeX公式的编辑器！

## 层级语法示例

### 无序列表
- 一级项目
  - 二级项目
    - 三级项目
- 另一个一级项目

### 有序列表
1. 第一步
   1. 子步骤1
   2. 子步骤2
2. 第二步
   - 混合使用
   - 无序子项

### 任务列表
- [x] 已完成任务
- [ ] 未完成任务
- [ ] 另一个任务

## 行内公式示例
爱因斯坦的质能方程：$E = mc^2$

二次方程求根公式：$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

## 块级公式示例
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

## 矩阵示例
$$
\\begin{pmatrix}
1 & 2 & 3 \\\\
4 & 5 & 6 \\\\
7 & 8 & 9
\\end{pmatrix}
$$

## 表格示例
| 姓名 | 年龄 | 职业 |
|------|------|------|
| 张三 | 25   | 工程师 |
| 李四 | 30   | 设计师 |

## 引用示例
> 这是一段引用
> 可以跨越多行
>> 嵌套引用

开始编写你的markdown...`);
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  
  // 存储用户消息及其对应的请求参数
  const [userMessageParams, setUserMessageParams] = useState<Record<string, any>>({});
  const [aiInput, setAiInput] = useState('');
  const [showTreeDemo, setShowTreeDemo] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<CodeMirrorEditorRef>(null);

  // @语法Hook (暂时保留，后续Phase 2会使用)
  useAtSyntax({
    onApplyMention: (mentionType) => {
      console.log('Applied mention:', mentionType);
    },
    editorRef
  });

  const [aiConfig, setAiConfig] = useState(() => {
    // 优先从localStorage加载配置
    const savedConfig = loadConfigFromStorage();
    if (savedConfig && savedConfig.provider) {
      return {
        provider: savedConfig.provider || 'ollama',
        model: savedConfig.model || 'qwen2.5:7b',
        thinkingMode: savedConfig.thinkingMode || false,
        maxTokens: savedConfig.maxTokens || 1000
      };
    }

    // 默认配置
    return {
      provider: 'ollama',
      model: 'qwen2.5:7b',
      thinkingMode: false,
      maxTokens: 1000
    };
  });

  const agentChat = useAgentChat();

  const ensureAgentSession = async () => {
    await agentChat.ensureSession(markdown, 'Untitled');
  };

  const handleAgentPatch = async (_version: number) => {
    if (!agentChat.sessionId) return;
    try {
      const { content } = await agentApi.getDocument(agentChat.sessionId);
      setMarkdownWithHistory(content);
    } catch (e) {
      console.error('failed to fetch authoritative document:', e);
    }
  };

  const [showAIAssistant, setShowAIAssistant] = useState(false);
  // Agent panel defaults to collapsed: when expanded the fixed panel
  // (z-[10000]) would otherwise cover the AI floating button + drawer (z-[9999]),
  // hiding the provider/model settings tab. See App.tsx render section.
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  // 对话管理：清空对话
  const handleClearConversation = () => {
    setAiMessages([]);
  };

  // 对话管理：撤销从指定消息开始的所有对话
  const handleUndoFromMessage = useCallback((messageId: string) => {
    // 1. 找到消息索引
    const messageIndex = aiMessages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const message = aiMessages[messageIndex];
    if (message.role !== 'user') return;

    // 2. 检查是否有正在进行的流式响应（ID以stream-开头且内容为空或以换行结尾表示仍在流式中）
    const hasActiveStreaming = aiMessages.some(m => {
      if (!m.id.startsWith('stream-')) return false;
      // 流式响应未完成：内容为空或以换行符结尾
      return m.content.length === 0 || m.content.endsWith('\n');
    });
    if (hasActiveStreaming) {
      // 提示用户等待响应完成
      console.log('请等待当前响应完成后再撤销');
      return;
    }

    // 3. 获取文档快照
    const snapshot = message.documentSnapshot;

    // 4. 删除该消息及之后所有消息
    const newMessages = aiMessages.slice(0, messageIndex);
    setAiMessages(newMessages);

    // 5. 恢复文档内容（如果有快照）
    if (snapshot !== undefined) {
      setMarkdown(snapshot);  // 直接设置，不通过 setMarkdownWithHistory
    }

    // 6. 清理相关的请求参数
    setUserMessageParams(prev => {
      const newParams = { ...prev };
      // 删除被撤销消息的参数
      delete newParams[messageId];
      return newParams;
    });
  }, [aiMessages]);

  // 对话管理：导出对话
  const handleExportConversation = () => {
    const exportContent = aiMessages.map(msg => {
      const role = msg.role === 'user' ? '👤 用户' : '🤖 AI助手';
      return `## ${role}\n\n${msg.content}\n\n---\n`;
    }).join('\n');

    const blob = new Blob([`# AI对话记录\n\n导出时间: ${new Date().toLocaleString()}\n\n---\n\n${exportContent}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-conversation-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 快捷指令点击处理
  const handleQuickActionClick = (action: QuickAction) => {
    setAiInput(action.prompt);
  };

  // 处理AI配置变化
  const handleAiConfigChange = (newConfig: typeof aiConfig) => {
    setAiConfig(newConfig);
    saveConfigToStorage(newConfig);
  };

  // 应用主题到DOM根元素
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 从后端加载 providers
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const data = await aiApi.getProviders();
        setBackendProviders(data.providers);
      } catch (e) {
        console.error('Failed to load providers:', e);
      }
    };
    loadProviders();
  }, []);

  // 快捷键：Ctrl+Shift+A 切换AI助手
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setShowAIAssistant(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 检测编辑器选区变化
  useEffect(() => {
    const checkSelection = () => {
      if (editorRef.current) {
        const selection = editorRef.current.getSelection();
        setHasSelection(!!selection && selection.text.length > 0);
      }
    };

    // 每500ms检查一次选区状态
    const interval = setInterval(checkSelection, 500);
    return () => clearInterval(interval);
  }, []);

  // 在组件初始化时将初始markdown内容保存到历史记录中
  useEffect(() => {
    saveToHistory(markdown);
    setHistoryIndex(0);
  }, []);

  // 滚动同步标志
  const isScrollSyncingRef = useRef(false);

  // 编辑器滚动时同步预览区
  const handleEditorScroll = (_scrollTop: number, scrollRatio: number) => {
    if (isScrollSyncingRef.current) return;
    if (showTreeDemo) return;

    const previewElement = previewRef.current;
    if (!previewElement) return;

    isScrollSyncingRef.current = true;

    // 根据比例同步预览区的滚动位置
    const maxScroll = previewElement.scrollHeight - previewElement.clientHeight;
    previewElement.scrollTop = scrollRatio * maxScroll;

    requestAnimationFrame(() => {
      isScrollSyncingRef.current = false;
    });
  };

  // 预览区滚动时同步编辑器
  useEffect(() => {
    if (showTreeDemo) return;

    const previewElement = previewRef.current;
    if (!previewElement) return;

    const handlePreviewScroll = () => {
      if (isScrollSyncingRef.current) return;

      isScrollSyncingRef.current = true;

      // 计算预览区的滚动比例
      const maxScroll = previewElement.scrollHeight - previewElement.clientHeight;
      const previewScrollRatio = maxScroll > 0 ? previewElement.scrollTop / maxScroll : 0;

      // 根据比例同步编辑区的滚动位置
      try {
        const scrollInfo = editorRef.current?.getScrollInfo();
        if (scrollInfo) {
          const editorScrollHeight = scrollInfo.scrollHeight - scrollInfo.clientHeight;
          editorRef.current?.scrollTo(previewScrollRatio * editorScrollHeight);
        }
      } catch (error) {
        console.error('设置编辑区滚动位置时出错:', error);
      }

      requestAnimationFrame(() => {
        isScrollSyncingRef.current = false;
      });
    };

    previewElement.addEventListener('scroll', handlePreviewScroll);

    return () => {
      previewElement.removeEventListener('scroll', handlePreviewScroll);
    };
  }, [showTreeDemo]);

  // 自动滚动到最新消息
  useEffect(() => {
    if (messagesEndRef.current && aiMessages.length > 0) {
      // 检查消息容器是否在底部附近（允许一些误差）
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        
        // 检查是否有流式消息正在进行
        const hasStreamingMessage = aiMessages.some(msg => msg.id.startsWith('stream-') && msg.content.length > 0);
        
        // 在以下情况自动滚动到最新消息：
        // 1. 用户在底部附近
        // 2. 有流式消息正在进行（确保用户能看到实时输出）
        if (isNearBottom || hasStreamingMessage) {
          // 使用容器内的滚动而不是整个页面的滚动
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end',
            inline: 'nearest'
          });
        }
      }
    }
  }, [aiMessages]);

  // 显示当前配置来源和实际值
  const getCurrentConfigSource = () => {
    const providerLabel = backendProviders[aiConfig.provider]?.name || aiConfig.provider;
    return `${providerLabel} - ${aiConfig.model}`;
  };

  // 保存当前状态到历史记录
  const saveToHistory = (content: string) => {
    // 如果当前不是在历史记录的最新状态，则截断历史记录
    const newHistory = historyIndex < history.length - 1 
      ? history.slice(0, historyIndex + 1) 
      : [...history];
    
    // 添加当前状态到历史记录
    newHistory.push(content);
    
    // 限制历史记录数量，避免占用过多内存
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // 撤回操作
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setMarkdown(history[prevIndex]);
      setHistoryIndex(prevIndex);
    }
  };

  // 重做操作
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setMarkdown(history[nextIndex]);
      setHistoryIndex(nextIndex);
      // 不再重置已执行操作的状态，保持按钮禁用状态
    }
  };

  // 自定义的setMarkdown函数，会在每次更新时保存到历史记录
  const setMarkdownWithHistory = (content: string | ((prev: string) => string)) => {
    if (typeof content === 'function') {
      // 如果传入的是函数，则先获取当前值，再调用函数计算新值
      setMarkdown(prev => {
        const newValue = content(prev);
        saveToHistory(newValue);
        return newValue;
      });
    } else {
      // 如果传入的是字符串，则直接设置新值并保存到历史记录
      setMarkdown(content);
      saveToHistory(content);
    }
    // 不再重置已执行操作的状态，保持按钮禁用状态
  };

  // 获取编辑器中的选区位置
  const getSelectionPosition = () => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      if (selection && selection.text) {
        return {
          start: selection.start,
          end: selection.end
        };
      }
    }

    // 如果没有选中内容，返回光标位置
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      if (selection) {
        return {
          start: selection.start,
          end: selection.start
        };
      }
    }

    return { start: 0, end: 0 };
  };






  // 在指定位置设置光标
  const setCursorPosition = (position: number) => {
    if (editorRef.current) {
      editorRef.current.setCursorPosition(position);
    }
  };

  // 应用AI回复到编辑区
  const applyAiResponse = (content: string, mode: 'replace' | 'append' | 'insert' | 'replace_selection' = 'append') => {
    if (mode === 'replace') {
      setMarkdownWithHistory(content);
    } else if (mode === 'append') {
      setMarkdownWithHistory(prev => prev + '\n\n' + content);
    } else if (mode === 'insert' || mode === 'replace_selection') {
      const { start, end } = getSelectionPosition();
      const newText = markdown.substring(0, start) + content + markdown.substring(end);
      setMarkdownWithHistory(newText);
      
      // 设置光标位置到插入内容之后
      setTimeout(() => {
        setCursorPosition(start + content.length);
      }, 0);
    }
  };

  const handleSave = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleNew = () => {
    setMarkdownWithHistory('# New Document\n\nStart writing...');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setMarkdownWithHistory(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleAiSend = async () => {
    if (aiInput.trim()) {
      // 获取编辑器中的选中内容
      let selectedText = '';
      let selectionRange = null;
      if (editorRef.current) {
        const selection = editorRef.current.getSelection();
        if (selection && selection.text) {
          selectedText = selection.text;
          selectionRange = {
            start: selection.start,
            end: selection.end
          };
        }
      }

      // 获取光标位置（使用字符偏移量）
      const cursorPosition = getSelectionPosition().start;

      // 检测消息中是否包含@标记
      const hasAtMention = /@(selection|cursor|document)/.test(aiInput);

      // 处理@标记，将@selection等替换为实际内容
      let processedMessage = aiInput;
      if (hasAtMention) {
        processedMessage = replaceAtMentions(
          aiInput,
          selectedText ? {
            start: selectionRange?.start || 0,
            end: selectionRange?.end || 0,
            text: selectedText
          } : null,
          markdown,
          cursorPosition
        );
      }

      // 优先使用用户输入的内容，如果没有输入内容但有选中文本，则使用选中文本
      const userMessage = processedMessage ? processedMessage : (selectedText ? selectedText : processedMessage);
      const messageId = Date.now().toString();
      
      // 使用用户在界面中设置的maxTokens值
      // 当maxTokens为-1时，表示无限制输出长度，不设置max_tokens参数
      const maxTokens = aiConfig.maxTokens === -1 ? undefined : (aiConfig.maxTokens || 1000);
      
      // 构建上下文信息
      let contextInfo = `当前文档内容：\n${markdown}\n\n光标位置: ${cursorPosition}`;
      if (selectedText && selectionRange) {
        contextInfo += `\n选中区域: "${selectedText}"\n选中区域起始位置: ${selectionRange.start}, 选中区域结束位置: ${selectionRange.end}`;
      }
      
      // 创建请求参数对象
      // 检查是否为Qwen模型
      const isQwenModel = /^qwen\/qwen/.test(aiConfig.model || '');
      
      const requestParams: any = {
        messages: [
          {
            role: 'system',
            content: generateSystemMessage({
              thinkingMode: aiConfig.thinkingMode,
              isQwenModel: isQwenModel,
              version: 'v2.0'
            })
          },
          { role: 'user', content: userMessage },
          { role: 'user', content: contextInfo }
        ],
        model: aiConfig.model,
        temperature: 0.7,
        stream: true
      };
      
      // 只有当maxTokens不是undefined时才添加max_tokens参数
      if (maxTokens !== undefined) {
        requestParams.max_tokens = maxTokens;
      }
      
      // 保存请求参数
      setUserMessageParams(prev => ({
        ...prev,
        [messageId]: requestParams
      }));

      // 保存当前文档快照用于撤销功能
      const currentDocumentSnapshot = markdown;

      setAiMessages(prev => [...prev, {
        role: 'user',
        content: userMessage,
        id: messageId,
        documentSnapshot: currentDocumentSnapshot
      }]);
      setAiInput('');

      try {
        // 创建一个新的流式响应消息
        const streamMessageId = `stream-${Date.now()}`;
        setAiMessages(prev => [...prev, {
          role: 'assistant',
          content: '',
          id: streamMessageId
        }]);
        // 使用generateSystemMessage函数生成系统提示词
        const isQwenModel = /^qwen\/qwen/.test(aiConfig.model || '');
        const systemMessage = generateSystemMessage({
          thinkingMode: aiConfig.thinkingMode,
          isQwenModel: isQwenModel,
          version: 'v2.0'
        });
        
        // 获取光标位置
        const cursorPosition = getSelectionPosition().start;
        // 获取选中区域
        const selection = window.getSelection();
        const selectionText = selection?.toString() || '';
        const selectionRange = selection && selection.rangeCount > 0 ? getSelectionPosition() : null;
        
        // 构建上下文信息
        let contextInfo = `当前文档内容：\n${markdown}\n\n光标位置: ${cursorPosition}`;
        if (selectionText && selectionRange) {
          contextInfo += `\n选中区域: "${selectionText}"\n选中区域起始位置: ${selectionRange.start}, 选中区域结束位置: ${selectionRange.end}`;
        }
        
        // 构建API请求参数
        const apiRequestBody: any = {
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
            { role: 'user', content: contextInfo }
          ],
          model: aiConfig.model,
          temperature: 0.7,
          stream: true  // 启用流式响应
        };
        
        // 只有当maxTokens不是undefined时才添加max_tokens参数
        if (maxTokens !== undefined) {
          apiRequestBody.max_tokens = maxTokens;
        }
        
        // 使用新的后端 API
        const chatContext: ChatContext = {
          document: markdown,
          cursor_position: cursorPosition,
        };

        // 如果有选中文本，添加 selection 到 context
        if (selectionText && selectionRange) {
          chatContext.selection = {
            text: selectionText,
            start: selectionRange.start,
            end: selectionRange.end,
          };
        }

        const stream = aiApi.chat({
          provider: aiConfig.provider,
          model: aiConfig.model,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage },
            { role: 'user', content: contextInfo }
          ],
          context: chatContext,
          options: {
            temperature: 0.7,
            max_tokens: maxTokens,
            thinking_mode: aiConfig.thinkingMode,
            stream: true,
          },
        });

        let accumulatedContent = '';

        for await (const chunk of stream) {
          if (chunk.type === 'content') {
            accumulatedContent += chunk.content;
            setAiMessages(prev => prev.map(msg =>
              msg.id === streamMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            ));
          } else if (chunk.type === 'error') {
            setAiMessages(prev => [...prev, {
              role: 'assistant',
              content: `API错误: ${chunk.error || '未知错误'}`,
              id: Date.now().toString()
            }]);
            break;
          } else if (chunk.type === 'done') {
            // 流式完成，更新消息ID，移除stream-前缀以启用发送按钮
            setAiMessages(prev => prev.map(msg =>
              msg.id === streamMessageId
                ? { ...msg, id: `msg-${Date.now()}` }
                : msg
            ));
            break;
          }
        }
      } catch (error) {
        setAiMessages(prev => [...prev, {
          role: 'assistant',
          content: `连接失败：${error instanceof Error ? error.message : '未知错误'}\n\n当前配置：\n- Provider: ${aiConfig.provider}\n- Model: ${aiConfig.model}\n\n请检查：\n1. 后端服务是否已启动\n2. 网络连接是否正常\n3. 配置是否正确`,
          id: Date.now().toString()
        }]);
      }
    }
  };

  const renderMarkdown = (text: string) => {
    // 处理LaTeX公式
    let processedText = text;
    
    // 处理行内公式 $...$
    processedText = processedText.replace(/\$([^$\n]+)\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula, { displayMode: false });
      } catch (error) {
        return match;
      }
    });
    
    // 处理块级公式 $$...$$
    processedText = processedText.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula, { displayMode: true });
      } catch (error) {
        return match;
      }
    });
    
    // 使用marked进行完整的markdown渲染
    marked.setOptions({
      breaks: true,
      gfm: true
    });
    
    // 使用marked渲染markdown
    return marked.parse(processedText);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {showTreeDemo ? (
        <div className="h-screen overflow-y-auto">
          <TreeDemo onBack={() => setShowTreeDemo(false)} />
        </div>
      ) : (
        <>
          <header className="glass-effect shadow-md border-b transition-all duration-fast ease-out" style={{ height: 'var(--header-height)', borderColor: 'var(--border-color)' }}>
            <div className="px-6">
              <div className="flex justify-between items-center" style={{ height: 'var(--header-height)' }}>
                <h1 className="text-lg font-bold flex items-center">
                  <img src={logo} alt="Logo" className="h-8 w-8 mr-3 hover-lift" style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }} />
                  <span className="text-gradient font-semibold tracking-tight" style={{ fontSize: 'var(--text-xl)' }}>智写助手</span>
                </h1>
                <div className="flex items-center space-x-3">
                  <div className="text-xs hidden lg:block" style={{ color: 'var(--text-tertiary)' }}>
                    当前配置: {getCurrentConfigSource()}
                  </div>
                  <button
                    onClick={() => setShowTreeDemo(true)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--ai-light)',
                      color: 'var(--ai-accent)',
                      border: '1px solid var(--ai-accent)'
                    }}
                  >
                    AI Provider
                  </button>
                  <button
                    onClick={handleNew}
                    className="px-3 py-1.5 text-xs font-medium rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    新建
                  </button>
                  <input
                    type="file"
                    accept=".md,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="px-3 py-1.5 text-xs font-medium rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md cursor-pointer"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    打开
                  </label>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1.5 text-xs font-medium text-white rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))'
                    }}
                  >
                    保存
                  </button>
                  <div className="flex items-center space-x-1 border-l pl-2" style={{ borderColor: 'var(--border-color)' }}>
                    <button
                      onClick={handleUndo}
                      disabled={historyIndex <= 0}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-fast ease-out ${historyIndex <= 0 ? 'cursor-not-allowed' : 'hover-lift shadow-sm hover:shadow-md'}`}
                      style={{
                        backgroundColor: historyIndex <= 0 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                        color: historyIndex <= 0 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      撤回
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={historyIndex >= history.length - 1}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-fast ease-out ${historyIndex >= history.length - 1 ? 'cursor-not-allowed' : 'hover-lift shadow-sm hover:shadow-md'}`}
                      style={{
                        backgroundColor: historyIndex >= history.length - 1 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                        color: historyIndex >= history.length - 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      重做
                    </button>
                  </div>
                  <div className="flex items-center space-x-1 border-l pl-2" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="relative">
                      <CustomThemeDropdown theme={theme} setTheme={setTheme} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="h-[calc(100vh-var(--header-height))]">
            <div className="grid grid-cols-2 h-full gap-0">
              {/* 左侧编辑区 */}
              <div className="overflow-hidden transition-all duration-300 hover:shadow-lg" style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}>
                <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="px-6 py-4 border-b glass-effect" style={{ borderColor: 'var(--border-color)' }}>
                    <h2 className="text-base font-semibold flex items-center" style={{ color: 'var(--text-secondary)' }}>
                      <svg className="w-5 h-5 mr-2" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Markdown 编辑器
                    </h2>
                  </div>
                  <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
                    <CodeMirrorEditor
                      ref={editorRef}
                      value={markdown}
                      onChange={(value) => setMarkdownWithHistory(value)}
                      theme={theme}
                      onScroll={handleEditorScroll}
                    />
                  </div>
                </div>
              </div>

              {/* 右侧预览区 */}
              <div className="overflow-hidden transition-all duration-300 hover:shadow-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="px-6 py-4 border-b glass-effect" style={{ borderColor: 'var(--border-color)' }}>
                    <h2 className="text-base font-semibold flex items-center" style={{ color: 'var(--text-secondary)' }}>
                      <svg className="w-5 h-5 mr-2" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      实时预览
                    </h2>
                  </div>
                  <div
                    ref={previewRef}
                    className="flex-1 overflow-y-auto p-6 preview-scrollbar-hide"
                    style={{ backgroundColor: 'var(--bg-primary)' }}
                  >
                    <div className="prose prose-sm max-w-none">
                      <div className="rounded-md shadow-sm p-6 min-h-full backdrop-blur-sm transition-all duration-200 hover:shadow-md" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </main>

          {/* AI助手浮动按钮 - 包含抽屉作为子元素 */}
          <AIFloatingButton
            onClick={() => setShowAIAssistant(true)}
            isStreaming={aiMessages.some(m => m.id.startsWith('stream-'))}
          >
            <AIAssistantDrawer
              isOpen={showAIAssistant}
              onClose={() => setShowAIAssistant(false)}
              config={aiConfig}
              onConfigChange={handleAiConfigChange}
              providers={backendProviders}
              conversationActions={{
                onClear: handleClearConversation,
                onExport: handleExportConversation
              }}
              messageCount={aiMessages.length}
            >
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {aiMessages.length === 0 ? (
                  <EmptyView />
                ) : (
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 preview-scrollbar-hide" ref={messagesContainerRef} style={{
                    backgroundColor: 'var(--bg-primary)',
                    minHeight: '300px'
                  }}>
                    {aiMessages.map((message) => (
                      <div key={message.id} className="group transition-all duration-200">
                        <MessageItem
                          message={message}
                          onApplyResponse={applyAiResponse}
                          requestParams={message.role === 'user' ? userMessageParams[message.id] : undefined}
                          getDocumentContent={() => markdown}
                          onUndoFromMessage={handleUndoFromMessage}
                        />
                      </div>
                    ))}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                )}
                <div className="border-t p-4 glass-effect" style={{
                  borderColor: 'var(--border-color)',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  flexShrink: 0
                }}>
                  {/* 快捷指令 */}
                  <QuickActions
                    onActionClick={handleQuickActionClick}
                    hasSelection={hasSelection}
                    disabled={aiMessages.some(m => m.id.startsWith('stream-'))}
                  />
                  <div className="flex space-x-3 items-stretch mt-2">
                    <TiptapInput
                      value={aiInput}
                      onChange={setAiInput}
                      onSend={handleAiSend}
                      placeholder="输入消息... Enter发送 Shift+Enter换行 (@ 引用内容)"
                      disabled={!aiInput.trim() || aiMessages.some(m => m.id.startsWith('stream-'))}
                      hasSelection={hasSelection}
                      onApplyMention={(mentionType) => {
                        console.log('Applied @mention:', mentionType);
                      }}
                    />
                    <button
                      onClick={handleAiSend}
                      disabled={!aiInput.trim() || aiMessages.some(m => m.id.startsWith('stream-'))}
                      className="px-5 py-3 text-sm font-medium text-white rounded-md hover-lift transition-all duration-fast ease-out shadow-md hover:shadow-lg disabled:shadow-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center border"
                      style={{
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))',
                        borderColor: 'var(--accent-primary)',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </AIAssistantDrawer>
          </AIFloatingButton>
        </>
      )}
        {/* Agent panel (new, coexists with legacy AI drawer during migration).
            Collapsed by default: the fixed panel sits at z-[10000] which would
            cover the AI floating button + drawer (z-[9999]) and hide the
            provider/model settings tab, so it only renders when explicitly opened. */}
        {showAgentPanel ? (
          <div className="fixed bottom-24 right-4 z-[10000] h-[32rem] w-96 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <span className="text-sm font-semibold">Agent</span>
              <div className="flex items-center gap-2">
                {!agentChat.sessionId && (
                  <button
                    onClick={ensureAgentSession}
                    className="rounded bg-slate-200 px-2 py-1 text-xs dark:bg-slate-700 dark:text-slate-200"
                  >
                    建立会话
                  </button>
                )}
                <button
                  onClick={() => setShowAgentPanel(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  title="收起 Agent"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-2.5rem)]">
              <AgentPanel
                turns={agentChat.turns}
                isRunning={agentChat.isRunning}
                error={agentChat.error}
                onSend={(msg) =>
                  agentChat.sendMessage(msg, {
                    provider: aiConfig.provider,
                    model: aiConfig.model,
                    selection: editorRef.current?.getSelection()?.text,
                    onDocumentPatch: handleAgentPatch,
                    getDocumentContent: () => markdown,
                    setDocumentContent: setMarkdownWithHistory,
                  })
                }
                onStop={agentChat.stop}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAgentPanel(true)}
            className="fixed bottom-6 left-6 z-[9999] flex items-center gap-1.5 rounded-full px-4 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300 hover:shadow-xl hover-lift"
            style={{
              background: 'linear-gradient(135deg, var(--ai-accent), var(--ai-hover))',
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)'
            }}
            title="打开 Agent 面板"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Agent
          </button>
        )}
    </div>
  );
}

export default App;
