/**
 * AI辅助Markdown编辑器 - JSON文件格式类型定义
 */

// 文件元数据
export interface FileMetadata {
  version: string;          // 文件格式版本 (e.g., "1.0.0")
  createdAt: string;        // ISO 8601格式的创建时间
  updatedAt: string;        // ISO 8601格式的最后更新时间
  application: string;      // 应用程序标识 (e.g., "ai-markdown-editor")
  appVersion: string;       // 应用程序版本
}

// AI消息接口
export interface AiMessage {
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
export interface AiRequestParams {
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
export interface AiConfig {
  provider: string;         // 提供商名称 (e.g., "deepseek", "kimi")
  baseUrl: string;          // API基础URL
  apiKey?: string;          // API密钥 (可选，安全考虑)
  model: string;            // 模型名称
  thinkingMode: boolean;    // 思考模式
  maxTokens: number;        // 最大token数
}

// 主文件接口
export interface MdAiFile {
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

// 序列化选项
export interface SerializeOptions {
  includeHistory?: boolean;      // 是否包含历史记录
  includeAiConfig?: boolean;     // 是否包含AI配置
  includeRequestParams?: boolean; // 是否包含请求参数
  compress?: boolean;            // 是否压缩JSON
}

// 转换选项
export interface ConvertOptions {
  createTime?: string;           // 指定创建时间
  addWelcomeMessage?: boolean;   // 是否添加欢迎消息
}

// 文件格式检测结果
export type FileFormat = 'md' | 'mdc' | 'unknown';

// 版本迁移函数类型
export type MigrationFunction = (data: any) => any;