import { MdAiFileHandler } from './MdAiFileHandler';
import { MdAiFile } from '../types/MdAiFile';

/**
 * 文件操作工具类
 * 处理浏览器的文件读写操作
 */
export class FileOperations {
  private fileHandler: MdAiFileHandler;

  constructor(fileHandler: MdAiFileHandler) {
    this.fileHandler = fileHandler;
  }

  /**
   * 从文件输入加载文件
   */
  async loadFromFileInput(file: File): Promise<MdAiFile> {
    try {
      const content = await this.readFileAsText(file);
      const loadedFile = await this.fileHandler.loadFromContent(content);
      return loadedFile;
    } catch (error) {
      throw new Error(`Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 保存文件到本地
   */
  async saveToFile(filename: string, format: 'md' | 'mdc' = 'mdc'): Promise<void> {
    try {
      let content: string;
      let finalFilename = filename;

      if (format === 'md') {
        content = this.fileHandler.exportAsMarkdown();
        if (!finalFilename.endsWith('.md')) {
          finalFilename += '.md';
        }
      } else {
        content = this.fileHandler.serializeToJson({
          includeHistory: true,
          includeAiConfig: true,
          includeRequestParams: true,
          compress: false
        });
        // 使用.mdc扩展名
        if (!finalFilename.endsWith('.mdc')) {
          finalFilename += '.mdc';
        }
      }

      this.downloadFile(content, finalFilename);
    } catch (error) {
      throw new Error(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 读取文件为文本
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      reader.readAsText(file);
    });
  }

  /**
   * 下载文件到本地
   */
  private downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: this.getMimeType(filename) });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * 根据文件扩展名获取MIME类型
   */
  private getMimeType(filename: string): string {
    if (filename.endsWith('.mdc')) {
      return 'application/json';
    } else if (filename.endsWith('.md')) {
      return 'text/markdown';
    }
    return 'text/plain';
  }

  /**
   * 获取建议的文件名
   */
  getSuggestedFilename(): string {
    const file = this.fileHandler.getCurrentFile();
    if (!file) {
      return 'document';
    }

    // 尝试从Markdown内容中提取标题作为文件名
    const titleMatch = file.markdown.match(/^#\s+(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      return this.sanitizeFilename(titleMatch[1]);
    }

    return 'document';
  }

  /**
   * 清理文件名（移除非法字符）
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '') // 移除非法字符
      .replace(/\s+/g, '_')         // 空格替换为下划线
      .substring(0, 50);            // 限制长度
  }

  /**
   * 检查文件是否已修改
   */
  isFileModified(originalFile?: MdAiFile): boolean {
    const currentFile = this.fileHandler.getCurrentFile();
    if (!currentFile || !originalFile) {
      return false;
    }

    // 简单的修改检查：比较Markdown内容和消息数量
    return currentFile.markdown !== originalFile.markdown ||
           currentFile.aiMessages.length !== originalFile.aiMessages.length;
  }

  /**
   * 创建文件拖放处理
   */
  createDropHandler(
    dropArea: HTMLElement,
    onFileLoad: (file: MdAiFile) => void,
    onError: (error: string) => void
  ): void {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    dropArea.addEventListener('dragover', preventDefault);
    dropArea.addEventListener('dragenter', preventDefault);
    dropArea.addEventListener('dragleave', preventDefault);

    dropArea.addEventListener('drop', async (e) => {
      preventDefault(e);
      
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        
        // 检查文件类型
        if (!this.isSupportedFileType(file.name)) {
          onError('不支持的文件类型。请选择 .md 或 .mdc 文件。');
          return;
        }

        try {
          const loadedFile = await this.loadFromFileInput(file);
          onFileLoad(loadedFile);
        } catch (error) {
          onError(`加载文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
    });
  }

  /**
   * 检查是否支持的文件类型
   */
  isSupportedFileType(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'md' || ext === 'mdc';
  }

  /**
   * 获取文件大小信息
   */
  getFileSizeInfo(file: MdAiFile): { 
    markdownSize: number; 
    messagesSize: number;
    totalSize: number;
  } {
    const jsonString = this.fileHandler.serializeToJson({ compress: true });
    
    return {
      markdownSize: new Blob([file.markdown]).size,
      messagesSize: new Blob([JSON.stringify(file.aiMessages)]).size,
      totalSize: new Blob([jsonString]).size
    };
  }
}