import { 
  MdAiFile, 
  FileFormat, 
  SerializeOptions, 
  ConvertOptions,
  AiMessage,
  FileMetadata
} from '../types/MdAiFile';

/**
 * AI辅助Markdown文件处理器
 * 负责文件的序列化、反序列化和格式转换
 */
export class MdAiFileHandler {
  private currentFile: MdAiFile | null = null;

  /**
   * 检测文件格式
   */
  detectFormat(content: string): FileFormat {
    try {
      // 尝试解析为JSON
      const parsed = JSON.parse(content);
      
      // 检查是否包含必要的字段
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

  /**
   * 从JSON字符串解析文件
   */
  parseFromJson(jsonString: string): MdAiFile {
    try {
      const parsed = JSON.parse(jsonString);
      
      // 基本验证
      if (!parsed.metadata || !parsed.markdown || !parsed.aiMessages) {
        throw new Error('Invalid MdAi file format: missing required fields');
      }

      // 版本迁移检查
      const migratedData = this.migrateIfNeeded(parsed);
      
      this.currentFile = migratedData;
      return migratedData;
    } catch (error) {
      throw new Error(`Failed to parse MdAi file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  /**
   * 获取当前文件
   */
  getCurrentFile(): MdAiFile | null {
    return this.currentFile;
  }

  /**
   * 设置当前文件
   */
  setCurrentFile(file: MdAiFile): void {
    this.currentFile = file;
  }

  /**
   * 更新Markdown内容
   */
  updateMarkdown(content: string): void {
    if (!this.currentFile) {
      throw new Error('No file loaded');
    }
    this.currentFile.markdown = content;
    this.currentFile.metadata.updatedAt = new Date().toISOString();
  }

  /**
   * 添加AI消息
   */
  addAiMessage(message: AiMessage): void {
    if (!this.currentFile) {
      throw new Error('No file loaded');
    }
    this.currentFile.aiMessages.push(message);
    this.currentFile.metadata.updatedAt = new Date().toISOString();
  }

  /**
   * 添加用户消息参数
   */
  addUserMessageParams(messageId: string, params: any): void {
    if (!this.currentFile) {
      throw new Error('No file loaded');
    }
    this.currentFile.userMessageParams[messageId] = params;
  }

  /**
   * 版本迁移
   */
  private migrateIfNeeded(data: any): MdAiFile {
    const currentVersion = "1.0.0";
    
    if (!data.metadata || !data.metadata.version) {
      // 没有版本信息，假设是最新版本
      return {
        ...data,
        metadata: {
          version: currentVersion,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          application: data.metadata?.application || "ai-markdown-editor",
          appVersion: data.metadata?.appVersion || this.getAppVersion()
        }
      };
    }

    // 这里可以添加版本迁移逻辑
    // 例如：if (data.metadata.version === "0.9.0") { ... }

    return data;
  }

  /**
   * 获取应用程序版本
   */
  private getAppVersion(): string {
    // 这里可以从package.json或其他配置获取
    return "1.0.0";
  }

  /**
   * 创建新的空文件
   */
  createNewFile(): MdAiFile {
    const now = new Date().toISOString();
    
    const metadata: FileMetadata = {
      version: "1.0.0",
      createdAt: now,
      updatedAt: now,
      application: "ai-markdown-editor",
      appVersion: this.getAppVersion()
    };

    const welcomeMessage: AiMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `👋 欢迎使用AI智能Markdown编辑器！\n\n我是您的专属AI助手，可以帮助您优化和编辑Markdown内容。`,
      timestamp: now
    };

    this.currentFile = {
      metadata,
      markdown: '# 新文档\n\n开始编写您的Markdown内容...',
      aiMessages: [welcomeMessage],
      userMessageParams: {},
      originalFormat: 'mdc'
    };

    return this.currentFile;
  }

  /**
   * 清除当前文件
   */
  clear(): void {
    this.currentFile = null;
  }
}