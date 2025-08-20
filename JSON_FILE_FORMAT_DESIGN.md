# AI辅助Markdown编辑器 - JSON文件格式设计

## 概述

本文档设计了一个新的JSON文件格式，用于同时保存Markdown内容和AI聊天记录，支持向后兼容传统的`.md`文件。

## 文件扩展名建议

建议使用以下扩展名之一：
- `.mdc` (Markdown with Conversation) - **推荐使用**
- `.mdai` (Markdown with AI) - 向后兼容支持
- `.aimd` (AI Markdown)

**推荐使用 `.mdc`**，这是当前实现的标准扩展名，同时保持对 `.mdai` 文件的向后兼容支持。

## JSON数据结构设计

### 核心接口定义

```typescript
// 文件元数据
interface FileMetadata {
  version: string;          // 文件格式版本 (e.g., "1.0.0")
  createdAt: string;        // ISO 8601格式的创建时间
  updatedAt: string;        // ISO 8601格式的最后更新时间
  application: string;      // 应用程序标识 (e.g., "ai-markdown-editor")
  appVersion: string;       // 应用程序版本
}

// AI消息接口
interface AiMessage {
  id: string;               // 消息唯一标识
  role: 'user' | 'assistant' | 'system';
  content: string;          // 消息内容
  timestamp: string;        // ISO 8601格式的时间戳
  function_call?: {         // 函数调用信息
    name: string;
    arguments: Record<string, any>;
  };
}

// AI请求参数
interface AiRequestParams {
  messages: Array<{
    role: string;
    content: string;
  }>;
  model: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// AI配置
interface AiConfig {
  provider: string;         // 提供商名称 (e.g., "deepseek", "kimi")
  baseUrl: string;          // API基础URL
  apiKey?: string;          // API密钥 (可选，安全考虑)
  model: string;            // 模型名称
  thinkingMode: boolean;    // 思考模式
  maxTokens: number;        // 最大token数
}

// 主文件接口
interface MdAiFile {
  metadata: FileMetadata;
  markdown: string;         // Markdown内容
  aiMessages: AiMessage[];  // AI聊天记录
  userMessageParams: Record<string, AiRequestParams>; // 用户消息参数映射
  aiConfig?: AiConfig;      // AI配置 (可选)
  history?: string[];       // 编辑历史记录 (可选)
  historyIndex?: number;    // 历史记录索引 (可选)
  
  // 向后兼容字段
  originalFormat?: 'md' | 'mdc'; // 原始格式标识
  convertedFromMd?: boolean;      // 是否从MD转换而来
}
```

### 示例JSON结构

```json
{
  "metadata": {
    "version": "1.0.0",
    "createdAt": "2024-01-20T10:30:00.000Z",
    "updatedAt": "2024-01-20T11:45:00.000Z",
    "application": "ai-markdown-editor",
    "appVersion": "1.0.0"
  },
  "markdown": "# Hello Markdown\n\n这是一个示例文档...",
  "aiMessages": [
    {
      "id": "msg-123456",
      "role": "user",
      "content": "请帮我优化这段Markdown",
      "timestamp": "2024-01-20T10:35:00.000Z"
    },
    {
      "id": "msg-123457", 
      "role": "assistant",
      "content": "我已经优化了您的Markdown格式...",
      "timestamp": "2024-01-20T10:36:00.000Z",
      "function_call": {
        "name": "replace_content",
        "arguments": {
          "content": "# 优化后的标题\n\n这是优化后的内容..."
        }
      }
    }
  ],
  "userMessageParams": {
    "msg-123456": {
      "messages": [
        {"role": "system", "content": "系统提示词..."},
        {"role": "user", "content": "请帮我优化这段Markdown"}
      ],
      "model": "deepseek-chat",
      "temperature": 0.7,
      "max_tokens": 1000,
      "stream": true
    }
  },
  "aiConfig": {
    "provider": "deepseek",
    "baseUrl": "https://api.deepseek.com/v1",
    "model": "deepseek-chat",
    "thinkingMode": false,
    "maxTokens": 1000
  },
  "history": ["# 原始内容", "# 第一次修改", "# 优化后的标题\n\n这是优化后的内容..."],
  "historyIndex": 2,
  "originalFormat": "mdc"
}
```

## 序列化和反序列化接口

### 序列化接口

```typescript
interface MdAiSerializer {
  // 将当前状态序列化为JSON字符串
  serializeToJson(): string;
  
  // 将当前状态保存为文件
  saveToFile(filename: string, format: 'md' | 'mdc'): Promise<void>;
  
  // 导出为传统Markdown格式
  exportAsMarkdown(): string;
}

// 序列化选项
interface SerializeOptions {
  includeHistory?: boolean;      // 是否包含历史记录
  includeAiConfig?: boolean;     // 是否包含AI配置
  includeRequestParams?: boolean; // 是否包含请求参数
  compress?: boolean;            // 是否压缩JSON
}
```

### 反序列化接口

```typescript
interface MdAiDeserializer {
  // 从JSON字符串解析
  parseFromJson(jsonString: string): MdAiFile;
  
  // 从文件加载
  loadFromFile(file: File | string): Promise<MdAiFile>;
  
  // 检测文件格式
  detectFormat(content: string): 'md' | 'mdc' | 'unknown';
  
  // 从传统Markdown转换
  convertFromMarkdown(markdown: string, options?: ConvertOptions): MdAiFile;
}

// 转换选项
interface ConvertOptions {
  createTime?: string;           // 指定创建时间
  addWelcomeMessage?: boolean;   // 是否添加欢迎消息
}
```

## 向后兼容性策略

### 1. 文件格式检测

```typescript
function detectFileFormat(content: string): 'md' | 'mdc' | 'unknown' {
  try {
    const parsed = JSON.parse(content);
    if (parsed.metadata && parsed.markdown !== undefined) {
      return 'mdc';
    }
  } catch {
    // 不是有效的JSON，可能是传统Markdown
    if (content.trim().length > 0) {
      return 'md';
    }
  }
  return 'unknown';
}
```

### 2. 自动转换机制

```typescript
function convertMarkdownToMdc(markdown: string): MdAiFile {
  return {
    metadata: {
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      application: "ai-markdown-editor",
      appVersion: "1.0.0"
    },
    markdown: markdown,
    aiMessages: [
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: "👋 欢迎使用AI智能Markdown编辑器！\n\n这是一个从传统Markdown文件转换而来的文档。",
        timestamp: new Date().toISOString()
      }
    ],
    userMessageParams: {},
    convertedFromMd: true,
    originalFormat: "md"
  };
}
```

### 3. 传统Markdown支持

应用程序应该能够：
1. 自动检测`.md`文件并转换为`.mdc`格式
2. 提供导出为传统`.md`文件的功能
3. 保持`.md`、`.mdc`和`.mdai`格式的无缝兼容

## 版本控制机制

### 版本号格式
采用语义化版本号：`主版本.次版本.修订版本`

- **主版本**: 不兼容的格式变更
- **次版本**: 向后兼容的功能性新增
- **修订版本**: 向后兼容的问题修正

### 版本迁移策略

```typescript
interface VersionMigrator {
  // 检查并迁移旧版本
  migrateIfNeeded(fileData: any): MdAiFile;
  
  // 版本迁移映射
  migrations: Map<string, (data: any) => any>;
}

// 示例迁移函数
const migrations = new Map([
  ['0.9.0', (data) => {
    // 从0.9.0迁移到1.0.0
    return {
      ...data,
      metadata: {
        ...data.metadata,
        version: '1.0.0'
      }
    };
  }]
]);
```

## 安全考虑

1. **敏感信息处理**: API密钥等敏感信息应该可选存储
2. **数据验证**: 反序列化时进行严格的数据验证
3. **错误处理**: 提供完善的错误处理和恢复机制
4. **文件大小限制**:
   - 建议限制单个文件大小不超过10MB
   - 对于超过5MB的文件提供警告提示
   - 实现分块加载机制处理大文件
   - 考虑压缩存储选项减少文件体积

## 实现建议

### 1. 创建文件操作工具类

```typescript
class MdAiFileHandler {
  private currentFile: MdAiFile | null = null;

  /**
   * 检测文件格式
   */
  detectFormat(content: string): 'md' | 'mdc' | 'unknown' {
    try {
      const parsed = JSON.parse(content);
      if (parsed.metadata && parsed.markdown !== undefined) {
        return 'mdc';
      }
    } catch {
      if (content.trim().length > 0) {
        return 'md';
      }
    }
    return 'unknown';
  }

  /**
   * 从文件内容加载
   */
  async loadFromContent(content: string): Promise<MdAiFile> {
    const format = this.detectFormat(content);
    
    if (format === 'md') {
      this.currentFile = this.convertFromMarkdown(content, {
        addWelcomeMessage: true
      });
    } else if (format === 'mdc') {
      this.currentFile = this.parseFromJson(content);
    } else {
      // 尝试处理可能是.mdai格式的文件
      try {
        const parsed = JSON.parse(content);
        if (parsed.metadata && parsed.markdown !== undefined) {
          // 这是.mdai格式的文件，将其作为.mdc格式处理
          this.currentFile = this.parseFromJson(content);
        } else {
          throw new Error('Unsupported file format');
        }
      } catch {
        throw new Error('Unsupported file format');
      }
    }

    return this.currentFile;
  }

  /**
   * 从传统Markdown转换
   */
  convertFromMarkdown(markdown: string, options: ConvertOptions = {}): MdAiFile {
    const now = new Date().toISOString();
    
    const welcomeMessage: AiMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `👋 欢迎使用AI智能Markdown编辑器！\n\n这是一个从传统Markdown文件转换而来的文档。`,
      timestamp: now
    };

    const metadata: FileMetadata = {
      version: "1.0.0",
      createdAt: options.createTime || now,
      updatedAt: now,
      application: "ai-markdown-editor",
      appVersion: this.getAppVersion()
    };

    return {
      metadata,
      markdown: markdown,
      aiMessages: options.addWelcomeMessage ? [welcomeMessage] : [],
      userMessageParams: {},
      convertedFromMd: true,
      originalFormat: "md"
    };
  }

  /**
   * 序列化为JSON字符串
   */
  serializeToJson(options: SerializeOptions = {}): string {
    if (!this.currentFile) {
      throw new Error('No file loaded');
    }

    const dataToSerialize: Partial<MdAiFile> = {
      metadata: {
        ...this.currentFile.metadata,
        updatedAt: new Date().toISOString()
      },
      markdown: this.currentFile.markdown,
      aiMessages: this.currentFile.aiMessages,
      userMessageParams: options.includeRequestParams !== false ? this.currentFile.userMessageParams : {}
    };

    // 可选字段
    if (options.includeHistory && this.currentFile.history) {
      dataToSerialize.history = this.currentFile.history;
      dataToSerialize.historyIndex = this.currentFile.historyIndex;
    }

    if (options.includeAiConfig && this.currentFile.aiConfig) {
      dataToSerialize.aiConfig = this.currentFile.aiConfig;
    }

    // 向后兼容字段
    if (this.currentFile.originalFormat) {
      dataToSerialize.originalFormat = this.currentFile.originalFormat;
    }
    if (this.currentFile.convertedFromMd) {
      dataToSerialize.convertedFromMd = this.currentFile.convertedFromMd;
    }

    return options.compress
      ? JSON.stringify(dataToSerialize)
      : JSON.stringify(dataToSerialize, null, 2);
  }

  /**
   * 导出为传统Markdown格式
   */
  exportAsMarkdown(): string {
    if (!this.currentFile) {
      throw new Error('No file loaded');
    }
    return this.currentFile.markdown;
  }

  // ...其他实现细节
}
```

### 2. 集成到现有应用

在现有的App.tsx中集成：

```typescript
// 添加文件操作状态
const [currentFile, setCurrentFile] = useState<MdAiFile | null>(null);
const [fileHandler] = useState(new MdAiFileHandler());

// 修改保存功能
const handleSave = async (format: 'md' | 'mdc' = 'mdc') => {
  try {
    // 更新文件处理器中的当前内容
    fileHandler.updateMarkdown(markdown);
    
    // 添加当前AI消息到文件处理器
    const currentFile = fileHandler.getCurrentFile();
    if (currentFile) {
      currentFile.aiMessages = aiMessages;
      currentFile.userMessageParams = userMessageParams;
    }
    
    const filename = fileOperations.getSuggestedFilename();
    await fileOperations.saveToFile(filename, format);
    
    // 显示成功消息
    const formatInfo = {
      md: { ext: 'md', desc: '传统Markdown' },
      mdc: { ext: 'mdc', desc: 'AI增强格式' }
    };
    setAiMessages(prev => [...prev, createAssistantMessage(`✅ 文件保存成功！\n\n📄 文件名: ${filename}.${formatInfo[format].ext}\n💾 格式: ${formatInfo[format].desc}`)]);
  } catch (error) {
    setAiMessages(prev => [...prev, createAssistantMessage(`❌ 文件保存失败: ${error instanceof Error ? error.message : '未知错误'}`)]);
  }
};

// 修改打开功能
const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file && fileHandler) {
    const loadedFile = await fileHandler.openFile(file);
    setCurrentFile(loadedFile);
    setMarkdown(loadedFile.markdown);
    setAiMessages(loadedFile.aiMessages);
    setUserMessageParams(loadedFile.userMessageParams || {});
    
    // 更新文件处理器中的当前文件
    fileHandler.setCurrentFile(loadedFile);
    
    // 重置历史记录
    const newHistory = [loadedFile.markdown];
    setHistory(newHistory);
    setHistoryIndex(0);
    
    // 显示成功消息
    const formatType = file.name.endsWith('.mdc') ? 'AI增强格式' : file.name.endsWith('.md') ? '传统Markdown' : '未知格式';
    setAiMessages(prev => [...prev, createAssistantMessage(`✅ 文件加载成功！\n\n📄 文件名: ${file.name}\n📊 包含 ${loadedFile.aiMessages.length} 条AI对话记录\n💾 格式: ${formatType}`)]);
  }
};
```

## 总结

这个JSON文件格式设计提供了：
1. **完整的AI交互记录保存**
2. **向后兼容传统Markdown文件**
3. **版本控制和迁移机制**
4. **安全的数据处理**
5. **灵活的扩展性**

## 版本控制实现现状

### 当前实现状态
当前版本控制机制已基本实现，但存在以下局限性：

1. **版本迁移功能**: 目前仅支持基本版本检测，完整的版本迁移逻辑尚未完全实现
2. **向后兼容性**: 支持从`.mdai`到`.mdc`格式的自动转换，但复杂的版本迁移需要手动处理
3. **数据验证**: 实现了基本的数据结构验证，但缺少详细的版本兼容性检查

### 未来改进计划

1. **完整的版本迁移系统**: 实现自动化的版本升级路径
2. **详细的兼容性检查**: 添加更严格的版本兼容性验证
3. **迁移日志记录**: 记录版本迁移的详细过程和历史
4. **回滚机制**: 提供版本回滚功能以防迁移失败

## 兼容性说明

### 文件扩展名兼容性
- **`.mdc`**: 当前标准格式，推荐使用
- **`.mdai`**: 向后兼容支持，自动转换为`.mdc`格式
- **`.md`**: 传统Markdown格式，支持导入导出

### 版本兼容性
当前实现支持版本1.0.0格式，未来版本升级时将提供自动迁移工具。

通过这个设计，用户可以无缝地在传统Markdown和增强的AI Markdown格式之间切换，同时保留所有有价值的AI交互信息。