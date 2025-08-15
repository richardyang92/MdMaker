import React, { useState, useRef, useEffect } from 'react';
import './index.css';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { marked } from 'marked';
import providers from './ai-providers.json';
import MessageItem from './MessageItem';
import TreeDemo from './TreeDemo';
import logo from '/logo.svg';
import { generateSystemMessage } from './promptTemplates';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        className="w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-1 rounded-md shadow-sm text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          <span className="mr-2">{currentThemeLabel}</span>
          <svg className={`fill-current h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
          <div className="py-1 rounded-md">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                className={`w-full px-4 py-2 text-xs text-center ${
                  theme === option.value 
                    ? 'bg-blue-500 text-white font-medium' 
                    : `${
                        theme === 'dark' ? 'bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white' :
                        theme === 'eye-protect' ? 'bg-transparent text-green-700 hover:bg-green-100 hover:text-green-900' :
                        'text-gray-700 hover:bg-blue-100 hover:text-gray-900'  // light theme
                      }`
                } first:rounded-t-md last:rounded-b-md`}
                onClick={() => {
                  setTheme(option.value as any);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
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
}> = ({ options, value, onChange, placeholder, theme = 'light' }) => {
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
        className="w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-1 rounded-md shadow-sm text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-center"
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
        <div className="absolute z-10 mt-1 w-full rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 max-h-60 overflow-y-auto">
          <div className="py-1 rounded-md">
            {options.map((option) => (
              <button
                key={option.value}
                className={`w-full px-4 py-2 text-xs text-center ${
                  value === option.value 
                    ? 'bg-blue-500 text-white font-medium' 
                    : `${
                        theme === 'dark' ? 'bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white' :
                        theme === 'eye-protect' ? 'bg-transparent text-green-700 hover:bg-green-100 hover:text-green-900' :
                        'text-gray-700 hover:bg-blue-100 hover:text-gray-900'  // light theme
                      }`
                } first:rounded-t-md last:rounded-b-md`}
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
  const textareaRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const scrollSyncCleanupRef = useRef<(() => void) | null>(null);

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
        const fullText = model.getValue();
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
          selectedText = editorRef.current.getModel().getValueInRange(selection);
          // 获取选中区域的位置信息
          selectionRange = {
            start: selection.getStartPosition().column - 1, // Monaco Editor的列索引从1开始，我们需要从0开始
            end: selection.getEndPosition().column - 1
          };
        }
      }
      
      // 优先使用用户输入的内容，如果没有输入内容但有选中文本，则使用选中文本
      const userMessage = aiInput ? aiInput : (selectedText ? selectedText : aiInput);
      const messageId = Date.now().toString();
      
      // 获取光标位置
      let cursorPosition = 0;
      if (editorRef.current) {
        const position = editorRef.current.getPosition();
        if (position) {
          cursorPosition = position.column - 1; // Monaco Editor的列索引从1开始，我们需要从0开始
        }
      }
      
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
    <div className="min-h-screen bg-gray-50">
      {showTreeDemo ? (
        <div className="h-screen overflow-y-auto">
          <TreeDemo onBack={() => setShowTreeDemo(false)} />
        </div>
      ) : (
        <>
<header className="bg-white shadow-md border-b-2 border-gray-300">
            <div className="px-4 sm:px-4 lg:px-4">
<div className="flex justify-between items-center h-16">
<h1 className="text-xl font-bold flex items-center">
  <img src={logo} alt="Logo" className="h-8 w-8 mr-2" />
  <span className={theme === 'dark' ? 'text-white' : 'text-black'}>智写助手</span>
</h1>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <CustomThemeDropdown theme={theme} setTheme={setTheme} />
                  </div>
                  <div className="text-xs text-gray-500 mr-4">
                    当前配置: {getCurrentConfigSource()}
                  </div>
                  <button
                    onClick={() => setShowTreeDemo(true)}
                    className="px-4 py-2 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                  >
                    AI Provider信息
                  </button>
                  <button
                    onClick={handleNew}
                    className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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
                    className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    打开
                  </label>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className={`px-4 py-2 text-xs font-medium rounded-md ${historyIndex <= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-600 text-white hover:bg-gray-700'}`}
                  >
                    撤回
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className={`px-4 py-2 text-xs font-medium rounded-md ${historyIndex >= history.length - 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-600 text-white hover:bg-gray-700'}`}
                  >
                    重做
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="h-[calc(100vh-4rem)]">
            <div className="grid grid-cols-3 h-full gap-0">
              {/* 左侧预览区 */}
              <div className="bg-white border-r border-gray-200 overflow-hidden">
                <div className="h-full flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-medium text-gray-700">预览区</h2>
                  </div>
                  <div
                    ref={previewRef}
                    className="flex-1 overflow-y-auto p-4"
                    style={{
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                  >
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* 中间编辑区 */}
              <div className="bg-white border-r border-gray-200 overflow-hidden">
                <div className="h-full flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-medium text-gray-700">编辑区</h2>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <React.Suspense fallback={<div className="flex items-center justify-center h-full">Loading编辑器...</div>}>
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
                          theme: theme === 'dark' ? 'vs-dark' : 'vs'
                        }}
                      />
                    </React.Suspense>
                  </div>
                </div>
              </div>

              {/* 右侧AI交互区 */}
              <div className="bg-white overflow-hidden">
                <div className="h-full flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-medium text-gray-700">AI助手</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={messagesContainerRef}>
                    {aiMessages.map((message) => (
                      <MessageItem 
                        key={message.id} 
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
                    ))}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                  <div className="border-t border-gray-200 p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setAiInput('请帮我优化这段Markdown的格式');
                            handleAiSend();
                          }}
                          className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          优化格式
                        </button>
                        <button
                          onClick={() => {
                            setAiInput('请检查我的LaTeX公式是否正确');
                            handleAiSend();
                          }}
                          className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          检查公式
                        </button>
                        <button
                          onClick={() => {
                            setAiInput('请帮我生成一个表格来展示这些数据');
                            handleAiSend();
                          }}
                          className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          生成表格
                        </button>
                        <button
                          onClick={() => {
                            setAiInput('请帮我改进这段内容的表达');
                            handleAiSend();
                          }}
                          className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          改进表达
                        </button>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setAiMessages([]);
                            setUserMessageParams({});
                          }}
                          className="px-3 py-2 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          重置聊天
                        </button>
                        <button
                          onClick={() => setShowAiConfig(!showAiConfig)}
                          className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          {showAiConfig ? '隐藏' : '设置'}
                        </button>
                      </div>
                    </div>

                    {showAiConfig && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-md space-y-2">
                        {/* 显示当前实际配置值 */}
                        <div className="bg-gray-100 rounded p-2 mb-2">
                          <p className="text-xs text-gray-700 font-medium">当前实际配置：</p>
                          <p className="text-xs text-gray-600">Base URL: {getCurrentEnvValues().baseUrl || '使用默认值'}</p>
                          <p className="text-xs text-gray-600">API Key: {getCurrentEnvValues().apiKey ? '已设置' : '未设置'}</p>
                          <p className="text-xs text-gray-600">Model: {getCurrentEnvValues().model || '使用默认值'}</p>
                          <p className="text-xs text-gray-600">Thinking Mode: {aiConfig.thinkingMode ? '已启用' : '未启用'}</p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">提供商</label>
                          <CustomDropdown
                            options={Object.entries(providers).map(([key, provider]) => ({
                              value: key,
                              label: provider.name
                            }))}
                            value={aiConfig.provider}
                            onChange={(value) => {
                              const newProvider = value as keyof typeof providers;
                              const provider = providers[newProvider];
                              // 获取新提供商的maxTokens配置，默认为1000
                              // 保持当前的maxTokens设置，如果用户已经设置为-1则保持为-1
                              const maxTokens = aiConfig.maxTokens; // 保持当前设置
                              // 如果新提供商不需要API Key，则清空API Key
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
                            theme={theme}  // 传递主题属性
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">模型</label>
                          <CustomDropdown
                            options={providers[aiConfig.provider as keyof typeof providers].models.map(model => ({
                              value: model,
                              label: model
                            }))}
                            value={aiConfig.model}
                            onChange={(value) => setAiConfig({...aiConfig, model: value})}
                            theme={theme}  // 传递主题属性
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">API Base URL</label>
                          <input
                            type="text"
                            value={aiConfig.baseUrl}
                            onChange={(e) => setAiConfig({...aiConfig, baseUrl: e.target.value})}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded custom-select"
                            placeholder={providers[aiConfig.provider as keyof typeof providers].baseUrl}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
                          <input
                            type="password"
                            value={aiConfig.apiKey}
                            onChange={(e) => setAiConfig({...aiConfig, apiKey: e.target.value})}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded custom-select"
                            placeholder={providers[aiConfig.provider as keyof typeof providers].requiresKey ? '输入API密钥' : '无需API密钥'}
                            disabled={!providers[aiConfig.provider as keyof typeof providers].requiresKey}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Max Tokens</label>
                          <input
                            type="number"
                            value={aiConfig.maxTokens === -1 ? '-1' : aiConfig.maxTokens}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '') {
                                // If empty, set to default (1000)
                                setAiConfig({...aiConfig, maxTokens: 1000});
                                return;
                              }
                              const numValue = parseInt(value);
                              setAiConfig({...aiConfig, maxTokens: isNaN(numValue) ? 1000 : numValue});
                            }}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded custom-select"
                            placeholder="最大输出token数量 (-1为无限制)"
                          />
                          <div className="mt-1 text-xs text-gray-500">
                            输入-1表示无输出长度限制
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">思考模式</label>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={aiConfig.thinkingMode}
                              onChange={(e) => setAiConfig({...aiConfig, thinkingMode: e.target.checked})}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                              disabled={!(providers[aiConfig.provider as keyof typeof providers] as Provider).supportsThinkingMode}
                            />
                            <span className="ml-2 text-xs text-gray-700">
                              启用思考模式 {(providers[aiConfig.provider as keyof typeof providers] as Provider).supportsThinkingMode ? '(适用于Qwen3模型)' : '(当前提供商不支持)'}
                            </span>
                          </div>
                        </div>
                        <div className="pt-2">
                          <button
                            onClick={applyConfig}
                            className="w-full px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            应用配置
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAiSend()}
                        placeholder="输入消息或点击上方快捷指令..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleAiSend}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                      >
                        发送
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
