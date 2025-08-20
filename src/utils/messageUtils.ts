import { AiMessage } from '../types/MdAiFile';

/**
 * 创建AI消息的辅助函数
 */
export function createAiMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  id?: string,
  function_call?: { name: string; arguments: Record<string, any> }
): AiMessage {
  return {
    id: id || `msg-${Date.now()}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    function_call
  };
}

/**
 * 创建用户消息
 */
export function createUserMessage(content: string, id?: string): AiMessage {
  return createAiMessage('user', content, id);
}

/**
 * 创建助手消息
 */
export function createAssistantMessage(content: string, id?: string, function_call?: { name: string; arguments: Record<string, any> }): AiMessage {
  return createAiMessage('assistant', content, id, function_call);
}

/**
 * 创建系统消息
 */
export function createSystemMessage(content: string, id?: string): AiMessage {
  return createAiMessage('system', content, id);
}

/**
 * 创建欢迎消息
 */
export function createWelcomeMessage(): AiMessage {
  return createAssistantMessage(`👋 欢迎使用AI智能Markdown编辑器！

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

有什么我可以帮助您的吗？`);
}

/**
 * 转换旧格式消息到新格式
 */
export function convertToAiMessage(oldMessage: { role: string; content: string; id: string }): AiMessage {
  return {
    ...oldMessage,
    timestamp: new Date().toISOString(),
    function_call: undefined
  } as AiMessage;
}

/**
 * 批量转换消息
 */
export function convertMessages(oldMessages: Array<{ role: string; content: string; id: string }>): AiMessage[] {
  return oldMessages.map(convertToAiMessage);
}