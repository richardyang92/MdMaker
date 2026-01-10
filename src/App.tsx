import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { marked } from 'marked';
import providers from './ai-providers.json';
import MessageItem from './MessageItem';
import TreeDemo from './TreeDemo';
import logo from '/logo.svg';
import { generateSystemMessage } from './promptTemplates';
import { useAtSyntax } from './useAtSyntax';
import { AtSuggestionsMenu } from './AtSuggestionsMenu';
import { replaceAtMentions } from './AtSyntaxParser';
// 动态导入Monaco Editor
const Editor = React.lazy(() => import('@monaco-editor/react'));

// 定义提供商类型
interface Provider {
  name: string;
  baseUrl: string;
  models: string[];
  requiresKey: boolean;
  supportsThinkingMode?: boolean;
  maxTokens?: number;
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

// 自定义下拉组件
const CustomDropdown: React.FC<{
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  theme?: 'light' | 'dark' | 'eye-protect'; // 添加主题属性
}> = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 获取当前选中项的标签
  const currentLabel = options.find(option => option.value === value)?.label || placeholder || '请选择';

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          <span className="mr-2 truncate">{currentLabel}</span>
          <svg className={`fill-current h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[9999] mt-1 w-full dropdown-menu shadow-lg max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="py-1" style={{ borderRadius: 'var(--radius-md)' }}>
            {options.map((option) => (
              <button
                key={option.value}
                className="w-full px-4 py-2 text-xs text-center transition-all duration-fast ease-out dropdown-item first:rounded-t-md last:rounded-b-md"
                style={{
                  backgroundColor: value === option.value ? 'var(--accent-primary)' : 'transparent',
                  color: value === option.value ? 'var(--accent-text)' : 'var(--text-primary)'
                }}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span className="truncate">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  // 主题状态
  const [theme, setTheme] = useState<'light' | 'dark' | 'eye-protect'>('light');
  
  // 历史记录状态，用于实现撤回功能
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // 已执行操作的状态，用于跟踪哪些操作已被执行
  const [executedOperations, setExecutedOperations] = useState<Record<string, boolean>>({});
  
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
  const [aiMessages, setAiMessages] = useState<Array<{role: string, content: string, id: string}>>([]);
  
  // 存储用户消息及其对应的请求参数
  const [userMessageParams, setUserMessageParams] = useState<Record<string, any>>({});
  const [aiInput, setAiInput] = useState('');
  const [showTreeDemo, setShowTreeDemo] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const scrollSyncCleanupRef = useRef<(() => void) | null>(null);

  // @语法Hook
  const atSyntax = useAtSyntax({
    onApplyMention: (mentionType) => {
      console.log('Applied mention:', mentionType);
    },
    editorRef
  });

  // 获取当前环境变量
  const getCurrentEnvValues = () => {
    return {
      baseUrl: import.meta.env.VITE_AI_BASE_URL,
      apiKey: import.meta.env.VITE_AI_API_KEY,
      model: import.meta.env.VITE_AI_MODEL
    };
  };

  // 根据环境变量自动检测提供商
  const detectProvider = () => {
    const env = getCurrentEnvValues();
    
    // 检查是否匹配已知提供商
    for (const [key, provider] of Object.entries(providers)) {
      if (env.baseUrl === provider.baseUrl) {
        return key;
      }
    }
    
    // 特殊处理LM Studio
    if (env.baseUrl && env.baseUrl.includes('localhost:1234')) {
      return 'lmstudio';
    }
    
    // 默认返回deepseek
    return 'deepseek';
  };

  const [aiConfig, setAiConfig] = useState(() => {
    const env = getCurrentEnvValues();
    const detectedProvider = detectProvider();
    
    // 获取思考模式设置，默认为false
    const thinkingMode = import.meta.env.VITE_AI_THINKING_MODE === 'true';
    
    // 获取maxTokens设置，默认为1000
    let maxTokens: number;
    if (import.meta.env.VITE_AI_MAX_TOKENS !== undefined) {
      // 如果环境变量中设置了maxTokens，则使用该值
      const envMaxTokens = parseInt(import.meta.env.VITE_AI_MAX_TOKENS);
      maxTokens = isNaN(envMaxTokens) ? 1000 : envMaxTokens;
    } else {
      // 否则使用提供商的默认值
      const currentProvider = providers[detectedProvider as keyof typeof providers] as Provider;
      maxTokens = currentProvider?.maxTokens || 1000;
    }
      
      return {
        baseUrl: env.baseUrl || 'https://api.deepseek.com/v1',
        apiKey: env.apiKey || '',
        model: env.model || 'deepseek-chat',
        provider: detectedProvider,
        thinkingMode: thinkingMode,
        maxTokens: maxTokens
      };
  });

  const [showAiConfig, setShowAiConfig] = useState(false);

  // 检查是否需要配置
  const needsConfiguration = () => {
    // 如果是LM Studio，不需要API Key
    if (aiConfig.provider === 'lmstudio') {
      return !aiConfig.baseUrl || aiConfig.baseUrl === 'https://api.deepseek.com/v1';
    }
    // 其他提供商需要API Key
    return !aiConfig.apiKey || !aiConfig.baseUrl;
  };

  // 应用主题到DOM根元素
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 在组件初始化时将初始markdown内容保存到历史记录中
  useEffect(() => {
    saveToHistory(markdown);
    setHistoryIndex(0);
    
    // 添加欢迎消息
    const welcomeMessage = {
      role: 'assistant' as const,
      content: `👋 欢迎使用AI智能Markdown编辑器！

我是您的专属AI助手，可以帮助您：
- 📝 优化和格式化Markdown内容
- 📊 创建和编辑表格、图表
- 🔍 检查和修正LaTeX数学公式
- 💡 提供内容改进建议
- ⚡ 快速生成各种Markdown元素

您可以：
1. 在左侧编辑器中编写或粘贴Markdown内容
2. 在下方输入框向我提问或寻求帮助
3. 使用快捷按钮快速获取常用功能

有什么我可以帮助您的吗？`,
      id: `welcome-${Date.now()}`
    };
    setAiMessages([welcomeMessage]);
  }, []);

  // 实现编辑区和预览区的滚动联动
  useEffect(() => {
    console.log('🔍 [滚动同步] useEffect 开始执行，依赖项变化');
    
    // 创建一个函数来设置滚动同步
    const setupScrollSync = () => {
      const previewElement = previewRef.current;
      const editorElement = editorRef.current;

      console.log('🔍 [滚动同步] previewElement:', previewElement ? '存在' : '不存在');
      console.log('🔍 [滚动同步] editorElement:', editorElement ? '存在' : '不存在');
      console.log('🔍 [滚动同步] editorElement 类型:', typeof editorElement);
      console.log('🔍 [滚动同步] editorElement 方法:', editorElement ? Object.keys(editorElement).filter(key => typeof editorElement[key] === 'function') : '无');

      // 添加额外的检查，确保editorElement是Monaco Editor实例
      if (!editorElement || typeof editorElement !== 'object' || !editorElement.onDidScrollChange) {
        console.log('🔍 [滚动同步] editorElement 不是有效的Monaco Editor实例');
        return false;
      }

      if (!previewElement) {
        console.log('🔍 [滚动同步] previewElement 不存在，退出');
        return false;
      }

      // 检查Monaco Editor是否完全初始化
      if (!editorElement.getLayoutInfo || !editorElement.getContentHeight || !editorElement.getScrollTop || !editorElement.setScrollTop) {
        console.log('🔍 [滚动同步] Monaco Editor 未完全初始化，缺少必要方法');
        console.log('🔍 [滚动同步] 可用方法:', Object.keys(editorElement).filter(key => typeof editorElement[key] === 'function'));
        return false;
      }

      console.log('🔍 [滚动同步] 开始绑定滚动事件');

      // 用于防止滚动事件循环调用的标志
      let isSyncing = false;

      const handlePreviewScroll = () => {
        console.log('🔍 [滚动同步] 预览区滚动事件触发');
        if (isSyncing) return;
        isSyncing = true;

        // 计算预览区的滚动比例
        const previewScrollRatio = previewElement.scrollTop / (previewElement.scrollHeight - previewElement.clientHeight);
        
        // 根据比例同步编辑区的滚动位置
        // Monaco Editor的滚动方法
        try {
          const editorScrollHeight = editorElement.getContentHeight() - editorElement.getLayoutInfo().height;
          editorElement.setScrollTop(previewScrollRatio * editorScrollHeight);
        } catch (error) {
          console.error('🔍 [滚动同步] 设置编辑区滚动位置时出错:', error);
        }

        // 在下一个事件循环中重置标志
        setTimeout(() => {
          isSyncing = false;
        }, 0);
      };

      const handleEditorScroll = () => {
        console.log('🔍 [滚动同步] 编辑区滚动事件触发');
        if (isSyncing) return;
        isSyncing = true;

        // 计算编辑区的滚动比例
        try {
          const editorScrollTop = editorElement.getScrollTop();
          const editorScrollHeight = editorElement.getContentHeight() - editorElement.getLayoutInfo().height;
          const editorScrollRatio = editorScrollHeight > 0 ? editorScrollTop / editorScrollHeight : 0;
          
          // 根据比例同步预览区的滚动位置
          previewElement.scrollTop = editorScrollRatio * (previewElement.scrollHeight - previewElement.clientHeight);
        } catch (error) {
          console.error('🔍 [滚动同步] 设置预览区滚动位置时出错:', error);
        }

        // 在下一个事件循环中重置标志
        setTimeout(() => {
          isSyncing = false;
        }, 0);
      };

      // 添加滚动事件监听器
      previewElement.addEventListener('scroll', handlePreviewScroll);
      
      // Monaco Editor的滚动事件监听
      let editorDisposable: { dispose: () => void } | undefined;
      try {
        editorDisposable = editorElement.onDidScrollChange(handleEditorScroll);
      } catch (error) {
        console.error('🔍 [滚动同步] 绑定编辑区滚动事件时出错:', error);
      }

      // 将清理函数存储在ref中，以便在组件卸载时调用
      const cleanup = () => {
        console.log('🔍 [滚动同步] 清理事件监听器');
        previewElement.removeEventListener('scroll', handlePreviewScroll);
        if (editorDisposable && typeof editorDisposable.dispose === 'function') {
          editorDisposable.dispose();
        }
      };
      
      // 将清理函数存储在ref中
      scrollSyncCleanupRef.current = cleanup;
      
      return true; // 成功设置滚动同步
    };

    // 尝试立即设置滚动同步
    let success = setupScrollSync();
    
    // 如果立即设置失败，设置定时器重试
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    if (!success) {
      retryTimer = setTimeout(() => {
        console.log('🔍 [滚动同步] 重试设置滚动同步');
        success = setupScrollSync();
        if (!success) {
          console.log('🔍 [滚动同步] 重试设置滚动同步失败');
        } else {
          console.log('🔍 [滚动同步] 重试设置滚动同步成功');
        }
      }, 300);
    }

    // 清理函数
    return () => {
      // 清除重试定时器
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      
      // 调用滚动同步清理函数
      if (scrollSyncCleanupRef.current) {
        scrollSyncCleanupRef.current();
        scrollSyncCleanupRef.current = null;
      }
    };
  }, [editorRef, previewRef]); // 依赖项改为editorRef和previewRef，这样当组件重新挂载时会重新绑定事件

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

  // 应用配置并保存到.env文件
  const applyConfig = async () => {
    const envContent = `# AI Configuration
# 支持的模型：deepseek-chat, deepseek-coder, kimi, lmstudio
VITE_AI_BASE_URL=${aiConfig.baseUrl}
VITE_AI_API_KEY=${aiConfig.apiKey}
VITE_AI_MODEL=${aiConfig.model}
VITE_AI_THINKING_MODE=${aiConfig.thinkingMode}
VITE_AI_MAX_TOKENS=${aiConfig.maxTokens}
`;
    
    try {
      // 发送请求到后端API保存配置
      const response = await fetch('http://localhost:3001/api/save-env', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ envContent }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 显示成功消息
        setAiMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `✅ ${result.message}
          
🔄 配置已立即生效，无需重启服务器
          
当前配置：
- 提供商: ${providers[aiConfig.provider as keyof typeof providers]?.name || '未知'}
- VITE_AI_BASE_URL: ${aiConfig.baseUrl || '未设置'}
- VITE_AI_API_KEY: ${aiConfig.apiKey ? '已设置' : '未设置'}
- VITE_AI_MODEL: ${aiConfig.model || '未设置'}
- VITE_AI_THINKING_MODE: ${aiConfig.thinkingMode ? 'true' : 'false'}
- VITE_AI_MAX_TOKENS: ${aiConfig.maxTokens}`,
          id: Date.now().toString()
        }]);
      } else {
        // 显示错误消息
        setAiMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `❌ 保存配置失败: ${result.message}`,
          id: Date.now().toString()
        }]);
      }
    } catch (error) {
      // 如果后端请求失败，显示错误消息
      setAiMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ 保存配置时出错: ${error instanceof Error ? error.message : '未知错误'}
        
请确保后端服务器正在运行 (npm run dev:server)`,
        id: Date.now().toString()
      }]);
    }
  };

  // 显示当前配置来源和实际值
  const getCurrentConfigSource = () => {
    const env = getCurrentEnvValues();
    if (env.baseUrl || env.apiKey || env.model) {
      return `来自.env文件: ${env.baseUrl || '默认URL'}`;
    }
    return "使用默认配置";
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
      // 撤回时重置已执行操作的状态，使按钮重新可用
      setExecutedOperations({});
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
      if (selection && !selection.isEmpty()) {
        const model = editorRef.current.getModel();
        const startPosition = selection.getStartPosition();
        const endPosition = selection.getEndPosition();
        
        // 获取选中区域前的文本
        const startOffset = model.getOffsetAt(startPosition);
        const endOffset = model.getOffsetAt(endPosition);
        
        return {
          start: startOffset,
          end: endOffset
        };
      }
    }
    
    // 如果没有选中内容，返回光标位置
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      if (position) {
        const model = editorRef.current.getModel();
        const offset = model.getOffsetAt(position);
        return {
          start: offset,
          end: offset
        };
      }
    }
    
    return { start: 0, end: 0 };
  };






  // 在指定位置设置光标
  const setCursorPosition = (position: number) => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        // 将字符偏移量转换为行和列位置
        const positionObj = model.getPositionAt(position);
        if (positionObj) {
          editorRef.current.setPosition(positionObj);
          editorRef.current.focus();
        }
      }
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
        if (selection && !selection.isEmpty()) {
          const model = editorRef.current.getModel();
          selectedText = model.getValueInRange(selection);
          // 获取选中区域的全局字符偏移量位置信息
          const startPosition = selection.getStartPosition();
          const endPosition = selection.getEndPosition();
          selectionRange = {
            start: model.getOffsetAt(startPosition),
            end: model.getOffsetAt(endPosition)
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
      
      setAiMessages(prev => [...prev, { 
        role: 'user', 
        content: userMessage,
        id: messageId
      }]);
      setAiInput('');
      
      // 检查是否需要配置
      if (needsConfiguration()) {
        const env = getCurrentEnvValues();
        const providerName = providers[aiConfig.provider as keyof typeof providers]?.name || '未知';
        
        let configMessage = `当前配置检查：\n`;
        configMessage += `- 提供商: ${providerName}\n`;
        configMessage += `- API Base URL: ${env.baseUrl || '未设置'}\n`;
        configMessage += `- 模型: ${env.model || '未设置'}\n`;
        
        if (aiConfig.provider === 'lmstudio') {
          configMessage += `- API Key: 无需API Key (LM Studio)\n`;
          if (!env.baseUrl || env.baseUrl === 'https://api.deepseek.com/v1') {
            configMessage += `\n⚠️ 需要配置LM Studio的Base URL\n`;
          }
        } else {
          configMessage += `- API Key: ${env.apiKey ? '已设置' : '未设置'}\n`;
          if (!env.apiKey) {
            configMessage += `\n⚠️ 需要配置API Key\n`;
          }
        }
        
        configMessage += `\n当前.env文件内容：\n`;
        configMessage += `VITE_AI_BASE_URL=${env.baseUrl || ''}\n`;
        configMessage += `VITE_AI_API_KEY=${env.apiKey || ''}\n`;
        configMessage += `VITE_AI_MODEL=${env.model || ''}\n\n`;
        
        if (!needsConfiguration()) {
          configMessage += `✅ 当前配置已正确设置！\n`;
          configMessage += `如果.env文件已正确配置，请重启开发服务器后刷新页面。`;
        } else {
          configMessage += `❌ 需要完善配置\n`;
          configMessage += `请根据当前提供商要求完善配置。`;
        }
        
        setAiMessages(prev => [...prev, { 
          role: 'assistant', 
          content: configMessage,
          id: Date.now().toString()
        }]);
        return;
      }

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // LM Studio不需要API Key
        if (aiConfig.provider !== 'lmstudio' && aiConfig.apiKey) {
          headers['Authorization'] = `Bearer ${aiConfig.apiKey}`;
        }
        
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
        
        // 使用fetch的流式响应处理
        const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(apiRequestBody)
        });

        if (response.ok) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder('utf-8');
          
          if (reader) {
            let accumulatedContent = '';
            
            // 读取流式响应
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                break;
              }
              
              // 解码接收到的数据
              const chunk = decoder.decode(value, { stream: true });
              
              // 处理服务器发送事件(SSE)格式的数据
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  
                  // 检查是否是结束标记
                  if (data === '[DONE]') {
                    break;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    
                    if (content) {
                      accumulatedContent += content;
                      
                      // 更新消息内容
                      setAiMessages(prev => prev.map(msg => 
                        msg.id === streamMessageId 
                          ? { ...msg, content: accumulatedContent } 
                          : msg
                      ));
                    }
                  } catch (e) {
                    // 忽略解析错误
                  }
                }
              }
            }
            
            // 关闭读取器
            reader.releaseLock();
          } else {
            // 如果不支持流式响应，回退到原来的实现
            const data = await response.json();
            const aiResponse = data.choices?.[0]?.message?.content || '抱歉，我无法处理这个请求。';
            
            // 更新消息内容
            setAiMessages(prev => prev.map(msg => 
              msg.id === streamMessageId 
                ? { ...msg, content: aiResponse } 
                : msg
            ));
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          setAiMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `API调用失败：${errorData.error?.message || response.statusText}\n\n当前配置：\n- Base URL: ${aiConfig.baseUrl}\n- Model: ${aiConfig.model}\n- Provider: ${providers[aiConfig.provider as keyof typeof providers]?.name}\n\n请检查：\n1. 服务是否已启动\n2. 网络连接是否正常\n3. 配置是否正确`,
            id: Date.now().toString()
          }]);
        }
      } catch (error) {
        setAiMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `连接失败：${error instanceof Error ? error.message : '未知错误'}\n\n当前配置：\n- Base URL: ${aiConfig.baseUrl}\n- Model: ${aiConfig.model}\n- Provider: ${providers[aiConfig.provider as keyof typeof providers]?.name}\n\n请检查：\n1. 服务是否已启动\n2. 网络连接是否正常\n3. 配置是否正确`,
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
            <div className="grid grid-cols-3 h-full gap-0">
              {/* 左侧预览区 */}
              <div className="overflow-hidden transition-all duration-300 hover:shadow-lg" style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}>
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

              {/* 中间编辑区 */}
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
                    <React.Suspense fallback={<div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-primary)' }}>加载编辑器中...</div>}>
                      <Editor
                        height="100%"
                        defaultLanguage="markdown"
                        value={markdown}
                        onChange={(value) => {
                          setMarkdownWithHistory(value || '');
                        }}
                        onMount={(editor) => {
                          editorRef.current = editor;
                          console.log('🔍 [滚动同步] Monaco Editor onMount 触发');
                          // 在编辑器挂载后重新设置滚动同步
                          if (scrollSyncCleanupRef.current) {
                            scrollSyncCleanupRef.current();
                            scrollSyncCleanupRef.current = null;
                          }
                          // 立即尝试设置滚动同步
                          setTimeout(() => {
                            const previewElement = previewRef.current;
                            if (previewElement) {
                              // 清理之前的事件监听器
                              const setupScrollSync = () => {
                                const editorElement = editorRef.current;
                                
                                console.log('🔍 [滚动同步] onMount后设置滚动同步');
                                console.log('🔍 [滚动同步] previewElement:', previewElement ? '存在' : '不存在');
                                console.log('🔍 [滚动同步] editorElement:', editorElement ? '存在' : '不存在');
                                
                                if (!editorElement || typeof editorElement !== 'object' || !editorElement.onDidScrollChange) {
                                  console.log('🔍 [滚动同步] editorElement 不是有效的Monaco Editor实例');
                                  return false;
                                }
                                
                                if (!editorElement.getLayoutInfo || !editorElement.getContentHeight || !editorElement.getScrollTop || !editorElement.setScrollTop) {
                                  console.log('🔍 [滚动同步] Monaco Editor 未完全初始化，缺少必要方法');
                                  return false;
                                }
                                
                                console.log('🔍 [滚动同步] 开始绑定滚动事件');
                                
                                // 用于防止滚动事件循环调用的标志
                                let isSyncing = false;
                                
                                const handlePreviewScroll = () => {
                                  console.log('🔍 [滚动同步] 预览区滚动事件触发');
                                  if (isSyncing) return;
                                  isSyncing = true;
                                
                                  // 计算预览区的滚动比例
                                  const previewScrollRatio = previewElement.scrollTop / (previewElement.scrollHeight - previewElement.clientHeight);
                                  
                                  // 根据比例同步编辑区的滚动位置
                                  try {
                                    const editorScrollHeight = editorElement.getContentHeight() - editorElement.getLayoutInfo().height;
                                    editorElement.setScrollTop(previewScrollRatio * editorScrollHeight);
                                  } catch (error) {
                                    console.error('🔍 [滚动同步] 设置编辑区滚动位置时出错:', error);
                                  }
                                
                                  // 在下一个事件循环中重置标志
                                  setTimeout(() => {
                                    isSyncing = false;
                                  }, 0);
                                };
                                
                                const handleEditorScroll = () => {
                                  console.log('🔍 [滚动同步] 编辑区滚动事件触发');
                                  if (isSyncing) return;
                                  isSyncing = true;
                                
                                  // 计算编辑区的滚动比例
                                  try {
                                    const editorScrollTop = editorElement.getScrollTop();
                                    const editorScrollHeight = editorElement.getContentHeight() - editorElement.getLayoutInfo().height;
                                    const editorScrollRatio = editorScrollHeight > 0 ? editorScrollTop / editorScrollHeight : 0;
                                    
                                    // 根据比例同步预览区的滚动位置
                                    previewElement.scrollTop = editorScrollRatio * (previewElement.scrollHeight - previewElement.clientHeight);
                                  } catch (error) {
                                    console.error('🔍 [滚动同步] 设置预览区滚动位置时出错:', error);
                                  }
                                
                                  // 在下一个事件循环中重置标志
                                  setTimeout(() => {
                                    isSyncing = false;
                                  }, 0);
                                };
                                
                                // 添加滚动事件监听器
                                previewElement.addEventListener('scroll', handlePreviewScroll);
                                
                                // Monaco Editor的滚动事件监听
                                let editorDisposable: { dispose: () => void } | undefined;
                                try {
                                  editorDisposable = editorElement.onDidScrollChange(handleEditorScroll);
                                } catch (error) {
                                  console.error('🔍 [滚动同步] 绑定编辑区滚动事件时出错:', error);
                                }
                                
                                // 将清理函数存储在ref中
                                const cleanup = () => {
                                  console.log('🔍 [滚动同步] 清理事件监听器');
                                  previewElement.removeEventListener('scroll', handlePreviewScroll);
                                  if (editorDisposable && typeof editorDisposable.dispose === 'function') {
                                    editorDisposable.dispose();
                                  }
                                };
                                
                                scrollSyncCleanupRef.current = cleanup;
                                return true;
                              };
                              
                              setupScrollSync();
                            }
                          }, 100); // 稍微延迟以确保DOM完全更新
                        }}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          wordWrap: 'on',
                          wrappingStrategy: 'advanced',
                          lineNumbers: 'on',
                          glyphMargin: false,
                          folding: true,
                          lineDecorationsWidth: 0,
                          lineNumbersMinChars: 3,
                          theme: theme === 'dark' ? 'vs-dark' : 'vs',
                          // 优化滚动条外观
                          smoothScrolling: true,
                          scrollbar: {
                            useShadows: false,
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8,
                            vertical: 'auto',
                            horizontal: 'auto'
                          }
                        }}
                      />
                    </React.Suspense>
                  </div>
                </div>
              </div>

              {/* 右侧AI交互区 */}
              <div className="overflow-hidden transition-all duration-300 hover:shadow-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="px-6 py-4 border-b glass-effect" style={{ borderColor: 'var(--border-color)' }}>
                    <h2 className="text-base font-semibold flex items-center" style={{ color: 'var(--text-secondary)' }}>
                      <svg className="w-5 h-5 mr-2" style={{ color: 'var(--ai-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      AI 智能助手
                    </h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 preview-scrollbar-hide" ref={messagesContainerRef} style={{ backgroundColor: 'var(--bg-primary)' }}>
                    {aiMessages.map((message) => (
                      <div key={message.id} className="group transition-all duration-200">
                        <MessageItem 
                          message={message} 
                          onApplyResponse={applyAiResponse} 
                          requestParams={message.role === 'user' ? userMessageParams[message.id] : undefined}
                          executedOperations={executedOperations}
                          setExecutedOperations={setExecutedOperations}
                          resetExecutedOperation={(messageId) => {
                            // 重置指定消息的执行状态
                            setExecutedOperations(prev => {
                              const newExecutedOperations = { ...prev };
                              delete newExecutedOperations[messageId];
                              return newExecutedOperations;
                            });
                          }}
                        />
                      </div>
                    ))}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                  <div className="border-t p-5 glass-effect" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setAiInput('请帮我优化这段Markdown的格式');
                            handleAiSend();
                          }}
                          className="px-3 py-2 text-xs rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
                          style={{
                            backgroundColor: 'var(--accent-light)',
                            color: 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)'
                          }}
                        >
                          ✨ 优化格式
                        </button>
                        <button
                          onClick={() => {
                            setAiInput('请检查我的LaTeX公式是否正确');
                            handleAiSend();
                          }}
                          className="px-3 py-2 text-xs rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
                          style={{
                            backgroundColor: 'var(--accent-light)',
                            color: 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)'
                          }}
                        >
                          🔍 检查公式
                        </button>
                        <button
                          onClick={() => {
                            setAiInput('请帮我生成一个表格来展示这些数据');
                            handleAiSend();
                          }}
                          className="px-3 py-2 text-xs rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
                          style={{
                            backgroundColor: 'var(--ai-light)',
                            color: 'var(--ai-accent)',
                            border: '1px solid var(--ai-accent)'
                          }}
                        >
                          📊 生成表格
                        </button>
                        <button
                          onClick={() => {
                            setAiInput('请帮我改进这段内容的表达');
                            handleAiSend();
                          }}
                          className="px-3 py-2 text-xs rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
                          style={{
                            backgroundColor: 'var(--accent-light)',
                            color: 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)'
                          }}
                        >
                          📝 改进表达
                        </button>
                      </div>
                      <div className="flex space-x-2 items-start">
                        <button
                          onClick={() => {
                            // 重置聊天并添加欢迎消息
                            const welcomeMessage = {
                              role: 'assistant' as const,
                              content: `👋 欢迎使用AI智能Markdown编辑器！

我是您的专属AI助手，可以帮助您：
- 📝 优化和格式化Markdown内容
- 📊 创建和编辑表格、图表
- 🔍 检查和修正LaTeX数学公式
- 💡 提供内容改进建议
- ⚡ 快速生成各种Markdown元素

您可以：
1. 在左侧编辑器中编写或粘贴Markdown内容
2. 在下方输入框向我提问或寻求帮助
3. 使用快捷按钮快速获取常用功能

有什么我可以帮助您的吗？`,
                              id: `welcome-${Date.now()}`
                            };
                            setAiMessages([welcomeMessage]);
                            setUserMessageParams({});
                          }}
                          className="px-3 py-2 text-xs rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          🗑️ 重置聊天
                        </button>
                        <button
                          onClick={() => setShowAiConfig(!showAiConfig)}
                          className="px-3 py-2 text-xs rounded-md hover-lift transition-all duration-fast ease-out shadow-sm hover:shadow-md"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          {showAiConfig ? '⚙️ 隐藏设置' : '⚙️ 显示设置'}
                        </button>
                      </div>
                    </div>

                    {showAiConfig && (
                      <div className="mb-4 p-5 rounded-lg shadow-lg border space-y-4 backdrop-blur-sm max-h-[60vh] overflow-y-auto transition-all duration-200 hover:shadow-xl"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                          borderRadius: 'var(--radius-lg)'
                        }}>
                        {/* 显示当前实际配置值 */}
                        <div className="rounded-md p-4 border transition-all duration-200 hover:shadow-md"
                          style={{
                            backgroundColor: 'var(--accent-light)',
                            borderColor: 'var(--accent-primary)',
                            borderRadius: 'var(--radius-md)'
                          }}>
                          <h4 className="text-sm font-semibold mb-3 flex items-center" style={{ color: 'var(--text-primary)' }}>
                            <svg className="w-4 h-4 mr-2" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            当前配置状态
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--accent-primary)' }}></div>
                              <span style={{ color: 'var(--text-secondary)' }}>Base URL: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{getCurrentEnvValues().baseUrl || '默认'}</span></span>
                            </div>
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getCurrentEnvValues().apiKey ? '#10B981' : '#EF4444' }}></div>
                              <span style={{ color: 'var(--text-secondary)' }}>API Key: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{getCurrentEnvValues().apiKey ? '已设置' : '未设置'}</span></span>
                            </div>
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--ai-accent)' }}></div>
                              <span style={{ color: 'var(--text-secondary)' }}>Model: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{getCurrentEnvValues().model || '默认'}</span></span>
                            </div>
                            <div className="flex items-center">
                              <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: aiConfig.thinkingMode ? '#10B981' : '#9CA3AF' }}></div>
                              <span style={{ color: 'var(--text-secondary)' }}>思考模式: <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{aiConfig.thinkingMode ? '已启用' : '未启用'}</span></span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-semibold mb-2 flex items-center" style={{ color: 'var(--text-primary)' }}>
                            <svg className="w-3 h-3 mr-2" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            提供商
                          </label>
                          <CustomDropdown
                            options={Object.entries(providers).map(([key, provider]) => ({
                              value: key,
                              label: provider.name
                            }))}
                            value={aiConfig.provider}
                            onChange={(value) => {
                              const newProvider = value as keyof typeof providers;
                              const provider = providers[newProvider];
                              const maxTokens = aiConfig.maxTokens;
                              const apiKey = provider.requiresKey ? aiConfig.apiKey : '';
                              setAiConfig({
                                ...aiConfig,
                                provider: newProvider,
                                baseUrl: provider.baseUrl,
                                model: provider.models[0],
                                apiKey: apiKey,
                                maxTokens: maxTokens
                              });
                            }}
                            theme={theme}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold mb-2 flex items-center" style={{ color: 'var(--text-primary)' }}>
                            <svg className="w-3 h-3 mr-2" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                            模型
                          </label>
                          <CustomDropdown
                            options={providers[aiConfig.provider as keyof typeof providers].models.map(model => ({
                              value: model,
                              label: model
                            }))}
                            value={aiConfig.model}
                            onChange={(value) => setAiConfig({...aiConfig, model: value})}
                            theme={theme}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-semibold mb-2 flex items-center" style={{ color: 'var(--text-primary)' }}>
                            <svg className="w-3 h-3 mr-2" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            API Base URL
                          </label>
                          <input
                            type="text"
                            value={aiConfig.baseUrl}
                            onChange={(e) => setAiConfig({...aiConfig, baseUrl: e.target.value})}
                            className="w-full px-3 py-2 text-xs rounded-md transition-all duration-fast ease-out shadow-sm focus:shadow-md backdrop-blur-sm"
                            style={{
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)'
                            }}
                            placeholder={providers[aiConfig.provider as keyof typeof providers].baseUrl}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-semibold mb-2 flex items-center" style={{ color: 'var(--text-primary)' }}>
                            <svg className="w-3 h-3 mr-2" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            API Key
                          </label>
                          <input
                            type="password"
                            value={aiConfig.apiKey}
                            onChange={(e) => setAiConfig({...aiConfig, apiKey: e.target.value})}
                            className="w-full px-3 py-2 text-xs rounded-md transition-all duration-fast ease-out shadow-sm focus:shadow-md backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)'
                            }}
                            placeholder={providers[aiConfig.provider as keyof typeof providers].requiresKey ? '输入API密钥' : '无需API密钥'}
                            disabled={!providers[aiConfig.provider as keyof typeof providers].requiresKey}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-semibold mb-2 flex items-center" style={{ color: 'var(--text-primary)' }}>
                            <svg className="w-3 h-3 mr-2" style={{ color: 'var(--accent-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4" />
                            </svg>
                            Max Tokens
                          </label>
                          <input
                            type="number"
                            value={aiConfig.maxTokens === -1 ? '-1' : aiConfig.maxTokens}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '') {
                                setAiConfig({...aiConfig, maxTokens: 1000});
                                return;
                              }
                              const numValue = parseInt(value);
                              setAiConfig({...aiConfig, maxTokens: isNaN(numValue) ? 1000 : numValue});
                            }}
                            className="w-full px-3 py-2 text-xs rounded-md transition-all duration-fast ease-out shadow-sm focus:shadow-md backdrop-blur-sm"
                            style={{
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)'
                            }}
                            placeholder="最大输出token数量 (-1为无限制)"
                          />
                          <div className="mt-1 text-xs rounded-md px-2 py-1 border"
                            style={{
                              color: 'var(--text-tertiary)',
                              backgroundColor: 'var(--accent-light)',
                              borderColor: 'var(--accent-primary)',
                              borderRadius: 'var(--radius-sm)'
                            }}>
                            💡 输入-1表示无输出长度限制
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-semibold mb-2 flex items-center" style={{ color: 'var(--text-primary)' }}>
                            <svg className="w-3 h-3 mr-2" style={{ color: 'var(--ai-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            思考模式
                          </label>
                          <div className="flex items-center rounded-md p-3 border transition-all duration-200 hover:shadow-md"
                            style={{
                              backgroundColor: 'var(--ai-light)',
                              borderColor: 'var(--ai-accent)',
                              borderRadius: 'var(--radius-md)'
                            }}>
                            <input
                              type="checkbox"
                              checked={aiConfig.thinkingMode}
                              onChange={(e) => setAiConfig({...aiConfig, thinkingMode: e.target.checked})}
                              className="h-4 w-4 rounded focus:ring-2 transition-all duration-fast ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ accentColor: 'var(--ai-accent)', borderColor: 'var(--border-color)' }}
                              disabled={!(providers[aiConfig.provider as keyof typeof providers] as Provider).supportsThinkingMode}
                            />
                            <span className="ml-3 text-xs" style={{ color: 'var(--text-primary)' }}>
                              <span className="font-medium">启用思考模式</span>
                              <br/>
                              <span style={{ color: 'var(--text-tertiary)' }}>
                                {(providers[aiConfig.provider as keyof typeof providers] as Provider).supportsThinkingMode ? '✅ 适用于Qwen3模型' : '❌ 当前提供商不支持'}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="pt-4">
                          <button
                            onClick={applyConfig}
                            className="w-full px-4 py-2.5 text-sm text-white rounded-md hover-lift transition-all duration-fast ease-out shadow-md hover:shadow-lg font-medium border"
                            style={{
                              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))',
                              borderColor: 'var(--accent-primary)',
                              borderRadius: 'var(--radius-md)'
                            }}
                          >
                            ✓ 应用配置
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-3 items-stretch">
                      <div className="flex-1 relative">
                        <textarea
                          ref={atSyntax.textareaRef}
                          value={aiInput}
                          onChange={(e) => {
                            setAiInput(e.target.value);
                            atSyntax.handleInputChange(e);
                          }}
                          onKeyDown={(e) => {
                            // 保留现有的Enter发送逻辑（当菜单未显示时）
                            if (e.key === 'Enter' && !e.shiftKey && !atSyntax.showAtMenu) {
                              e.preventDefault();
                              handleAiSend();
                            }
                            // 添加@菜单键盘导航
                            atSyntax.handleKeyDown(e);
                          }}
                          placeholder="输入消息... Enter发送 Shift+Enter换行 @引用选区"
                          className="w-full px-4 py-3 text-sm rounded-xl transition-all duration-fast ease-out shadow-sm focus:shadow-md backdrop-blur-sm resize-none"
                          style={{
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            minHeight: '44px',
                            maxHeight: '120px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '13px'
                          }}
                          rows={1}
                        />
                        {/* @建议菜单 */}
                        {atSyntax.showAtMenu && (
                          <AtSuggestionsMenu
                            position={atSyntax.atMenuPosition}
                            options={atSyntax.atOptions}
                            selectedIndex={atSyntax.selectedIndex}
                            setSelectedIndex={atSyntax.setSelectedIndex}
                            onSelectOption={(option) => {
                              atSyntax.applyAtOption(option);
                              // 更新aiInput状态
                              if (atSyntax.textareaRef.current) {
                                setAiInput(atSyntax.textareaRef.current.value);
                              }
                            }}
                            onClose={() => atSyntax.setShowAtMenu(false)}
                            editorRef={editorRef}
                          />
                        )}
                      </div>
                      <button
                        onClick={handleAiSend}
                        disabled={!aiInput.trim()}
                        className="px-5 py-3 text-sm font-medium text-white rounded-md hover-lift transition-all duration-fast ease-out shadow-md hover:shadow-lg disabled:shadow-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center space-x-2 h-full border"
                        style={{
                          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))',
                          borderColor: 'var(--accent-primary)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>发送</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </>
      )}
    </div>
  );
}

export default App;
