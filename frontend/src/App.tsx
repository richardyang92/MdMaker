import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import 'katex/dist/katex.min.css';
import { loadConfigFromStorage, saveConfigToStorage } from './components/ai-assistant/SettingsPanel';
import { ConfigModal } from './components/ai-assistant/ConfigModal';
import { aiApi } from './services/api/aiApi';
import type { ProviderInfo } from './services/types/ai';
import type { ContextItem } from './services/types/agent';
import { useAgentChat } from './hooks/useAgentChat';
import { agentApi } from './services/api/agentApi';
import { AppHeader, type Theme } from './components/layout/AppHeader';
import { DocumentView } from './components/document/DocumentView';
import { AgentSidebar } from './components/agent/AgentSidebar';

const INITIAL_DOCUMENT = `# Hello Markdown

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

开始编写你的markdown...`;

/**
 * Derive a short human label for a context snippet from its raw Markdown:
 * first non-empty line, `#` markers stripped, truncated.
 */
function deriveContextLabel(text: string, fallback: string): string {
  const firstLine = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return fallback;
  const cleaned = firstLine.replace(/^#+\s*/, '').trim() || firstLine;
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}…` : cleaned;
}

function App() {
  // 主题状态
  const [theme, setTheme] = useState<Theme>('light');

  // 后端 providers 状态
  const [backendProviders, setBackendProviders] = useState<Record<string, ProviderInfo>>({});

  // 文档内容（渲染稿的唯一数据源；直接编辑已移除，修改通过 Agent 完成）
  const [markdown, setMarkdown] = useState(INITIAL_DOCUMENT);

  // 用户从文档中「加入上下文」的片段集合（原始 Markdown）。每个片段带一个
  // 引用名（@ctx-N），可多个并存；发送后在聊天框里通过 @ctx-N 引用，
  // 未被引用的片段也会随消息附上（等价于旧的单选区行为）。可手动移除。
  const [attachedContexts, setAttachedContexts] = useState<ContextItem[]>([]);
  const contextCounter = useRef(0);

  const handleAddContext = useCallback((text: string) => {
    contextCounter.current += 1;
    const ref = `ctx-${contextCounter.current}`;
    setAttachedContexts((prev) => [
      ...prev,
      { ref, label: deriveContextLabel(text, `选区 ${contextCounter.current}`), content: text },
    ]);
  }, []);

  const handleClearContext = useCallback((ref: string) => {
    setAttachedContexts((prev) => prev.filter((c) => c.ref !== ref));
  }, []);

  const [aiConfig, setAiConfig] = useState(() => {
    const savedConfig = loadConfigFromStorage();
    if (savedConfig && savedConfig.provider) {
      return {
        provider: savedConfig.provider || 'ollama',
        model: savedConfig.model || 'qwen2.5:7b',
        thinkingMode: savedConfig.thinkingMode || false,
        maxTokens: savedConfig.maxTokens || 1000
      };
    }
    return {
      provider: 'ollama',
      model: 'qwen2.5:7b',
      thinkingMode: false,
      maxTokens: 1000
    };
  });

  const agentChat = useAgentChat();

  // 右栏 Agent 是否展开（默认常驻）
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const ensureAgentSession = async () => {
    await agentChat.ensureSession(markdown, 'Untitled');
  };

  // Agent 产出 document_patch 后，从后端拉取权威内容并写回本地状态。
  // 接收 sendMessage 内解析出的 sessionId，保证自动建会话后首条补丁也能生效。
  const handleAgentPatch = async (_version: number, sessionId: string) => {
    if (!sessionId) return;
    try {
      const { content } = await agentApi.getDocument(sessionId);
      setMarkdown(content);
    } catch (e) {
      console.error('failed to fetch authoritative document:', e);
    }
  };

  const handleSendToAgent = (message: string) => {
    void agentChat.sendMessage(message, {
      provider: aiConfig.provider,
      model: aiConfig.model,
      // 已附加的上下文片段（原始 Markdown）；后端会展开消息中的 @ctx-N 引用，
      // 未被引用的片段也会一并附上。片段保留在侧栏，可手动移除。
      // 始终显式发送（可为空数组），这样内建 @document 引用也能被展开。
      contexts: attachedContexts,
      onDocumentPatch: handleAgentPatch,
      getDocumentContent: () => markdown,
      setDocumentContent: setMarkdown,
    });
  };

  // 处理AI配置变化（配置弹窗使用）
  const handleAiConfigChange = (newConfig: typeof aiConfig) => {
    setAiConfig(newConfig);
    saveConfigToStorage(newConfig);
  };

  const handleNew = () => {
    setMarkdown('# New Document\n\nStart writing...');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setMarkdown(e.target?.result as string);
      };
      reader.readAsText(file);
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <AppHeader
        theme={theme}
        setTheme={setTheme}
        aiConfig={aiConfig}
        providers={backendProviders}
        onOpenConfig={() => setShowConfigModal(true)}
        onNew={handleNew}
        onOpenFile={handleFileUpload}
        onSave={handleSave}
      />

      <main className="h-[calc(100vh-var(--header-height))]">
        <div
          className="grid h-full gap-0 transition-all duration-300"
          style={{
            gridTemplateColumns: showAgentPanel ? '2fr 1fr' : '1fr',
          }}
        >
          {/* 左栏：渲染后的文档 */}
          <div className="relative h-full overflow-hidden">
            <DocumentView content={markdown} onAddContext={handleAddContext} />
            {!showAgentPanel && (
              <button
                onClick={() => setShowAgentPanel(true)}
                className="absolute top-3 right-4 z-10 flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium shadow-sm transition-all duration-fast ease-out hover-lift hover:shadow-md"
                style={{
                  backgroundColor: 'var(--ai-light)',
                  color: 'var(--ai-accent)',
                  border: '1px solid var(--ai-accent)',
                }}
                title="展开 Agent"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Agent
              </button>
            )}
          </div>

          {/* 右栏：常驻 Agent 侧边栏 */}
          {showAgentPanel && (
            <AgentSidebar
              agentChat={agentChat}
              onSend={handleSendToAgent}
              onEnsureSession={ensureAgentSession}
              onCollapse={() => setShowAgentPanel(false)}
              attachedContexts={attachedContexts}
              onClearContext={handleClearContext}
            />
          )}
        </div>
      </main>

      <ConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={aiConfig}
        onConfigChange={handleAiConfigChange}
        providers={backendProviders}
      />
    </div>
  );
}

export default App;
