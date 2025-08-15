// 系统提示词模板配置
export interface PromptTemplateConfig {
  thinkingMode: boolean;
  isQwenModel: boolean;
  version: string;
  features: string[];
}

// 基础模板变量
export interface TemplateVariables {
  mode: string;
  version: string;
  features: string;
  functionCallTemplate: string;
}

// 功能调用模板
/**
 * FUNCTION_CALL_TEMPLATE - 用于思考模式的完整功能调用模板
 *
 * 可用功能说明:
 * 1. replace_content: 替换整个文档内容
 *    - 参数规格: { "content": "markdown内容" } - content参数为要替换的完整markdown内容
 *    - 返回值: 无返回值
 *    - 功能详情: 完全替换当前编辑器中的所有内容，等同于applyAiResponse(content, 'replace')
 *    - 特殊考虑: 此操作会完全清除当前文档内容并替换为新内容
 *
 * 2. append_content: 追加内容到文档末尾
 *    - 参数规格: { "content": "markdown内容" } - content参数为要追加的markdown内容
 *    - 返回值: 无返回值
 *    - 功能详情: 在当前文档末尾添加新内容，自动添加两个换行符分隔，等同于applyAiResponse(content, 'append')
 *    - 特殊考虑: 新内容会以两个换行符与原文档分隔
 *
 * 3. insert_content: 在光标处插入内容
 *    - 参数规格: { "content": "markdown内容" } - content参数为要插入的markdown内容
 *    - 返回值: 无返回值
 *    - 功能详情: 在当前光标位置插入内容，如果存在选区则替换选区内容，等同于applyAiResponse(content, 'insert')
 *    - 特殊考虑: 操作完成后会将光标定位到插入内容的末尾
 *
 * 4. replace_selection: 替换选中文本
 *    - 参数规格: { "content": "markdown内容" } - content参数为要替换的markdown内容
 *    - 返回值: 无返回值
 *    - 功能详情: 替换当前选中的文本内容，如果没有选区则在光标处插入，等同于applyAiResponse(content, 'replace_selection')
 *    - 特殊考虑: 操作完成后会将光标定位到替换内容的末尾
 *
 * 所有功能调用:
 * - 参数: 每个函数调用都接受一个"content"参数，类型为string，包含markdown格式的内容
 * - 返回值: 所有函数调用均无返回值，直接操作编辑器状态
 * - 注意: 不要同时执行多个function_call，应根据用户需求选择最合适的一个
 */
const FUNCTION_CALL_TEMPLATE = `<think version="1.1">
  <context>用户正在使用Markdown编辑器</context>
  
  ## 可用功能
  - replace_content: 替换整个文档内容
    参数规格: { "content": "markdown内容" }
    功能详情: 完全替换当前编辑器中的所有内容，等同于applyAiResponse(content, 'replace')
    特殊考虑: 此操作会完全清除当前文档内容并替换为新内容
    
  - append_content: 追加内容到文档末尾
    参数规格: { "content": "markdown内容" }
    功能详情: 在当前文档末尾添加新内容，自动添加两个换行符分隔，等同于applyAiResponse(content, 'append')
    特殊考虑: 新内容会以两个换行符与原文档分隔
    
  - insert_content: 在光标处插入内容
    参数规格: { "content": "markdown内容" }
    功能详情: 在当前光标位置插入内容，如果存在选区则替换选区内容，等同于applyAiResponse(content, 'insert')
    特殊考虑: 操作完成后会将光标定位到插入内容的末尾
    
  - replace_selection: 替换选中文本
    参数规格: { "content": "markdown内容" }
    功能详情: 替换当前选中的文本内容，如果没有选区则在光标处插入，等同于applyAiResponse(content, 'replace_selection')
    特殊考虑: 操作完成后会将光标定位到替换内容的末尾

  ## 响应格式
  <function_call>
  {
    "name": "function_name",
    "arguments": {
      "content": "要操作的内容"
    }
  }
  </function_call>
 </think>`;

// 简化的功能调用模板（非思考模式）
/**
 * SIMPLE_FUNCTION_CALL_TEMPLATE - 用于非思考模式的简化功能调用模板
 *
 * 可用功能说明:
 * 1. replace_content: 替换整个文档内容
 *    - 参数规格: { "content": "markdown内容" } - content参数为要替换的完整markdown内容
 *    - 返回值: 无返回值
 *    - 功能详情: 完全替换当前编辑器中的所有内容，等同于applyAiResponse(content, 'replace')
 *    - 特殊考虑: 此操作会完全清除当前文档内容并替换为新内容
 *
 * 2. append_content: 追加内容到文档末尾
 *    - 参数规格: { "content": "markdown内容" } - content参数为要追加的markdown内容
 *    - 返回值: 无返回值
 *    - 功能详情: 在当前文档末尾添加新内容，自动添加两个换行符分隔，等同于applyAiResponse(content, 'append')
 *    - 特殊考虑: 新内容会以两个换行符与原文档分隔
 *
 * 3. insert_content: 在光标处插入内容
 *    - 参数规格: { "content": "markdown内容" } - content参数为要插入的markdown内容
 *    - 返回值: 无返回值
 *    - 功能详情: 在当前光标位置插入内容，如果存在选区则替换选区内容，等同于applyAiResponse(content, 'insert')
 *    - 特殊考虑: 操作完成后会将光标定位到插入内容的末尾
 *
 * 所有功能调用:
 * - 参数: 每个函数调用都接受一个"content"参数，类型为string，包含markdown格式的内容
 * - 返回值: 所有函数调用均无返回值，直接操作编辑器状态
 * - 注意: 不要同时执行多个function_call，应根据用户需求选择最合适的一个
 */
const SIMPLE_FUNCTION_CALL_TEMPLATE = `根据用户的需求，你可以通过function call的方式来执行特定的操作。可用的function call包括：
1. replace_content: 替换整个文档内容
   参数规格: { "content": "markdown内容" }
   功能详情: 完全替换当前编辑器中的所有内容，等同于applyAiResponse(content, 'replace')
   特殊考虑: 此操作会完全清除当前文档内容并替换为新内容
   
2. append_content: 追加内容到文档末尾
   参数规格: { "content": "markdown内容" }
   功能详情: 在当前文档末尾添加新内容，自动添加两个换行符分隔，等同于applyAiResponse(content, 'append')
   特殊考虑: 新内容会以两个换行符与原文档分隔
   
3. insert_content: 在光标位置插入内容
   参数规格: { "content": "markdown内容" }
   功能详情: 在当前光标位置插入内容，如果存在选区则替换选区内容，等同于applyAiResponse(content, 'insert')
   特殊考虑: 操作完成后会将光标定位到插入内容的末尾

请根据用户的具体需求选择合适的function call，并以以下格式返回：
<function_call>
{
  "name": "function_name",
  "arguments": {
    "content": "要操作的内容"
  }
}
</function_call>`;

// 生成系统提示词
export function generateSystemPrompt(config: PromptTemplateConfig): string {
  const mode = config.thinkingMode ? '专业的' : '高效的';
  const features = config.thinkingMode ? '丰富' : '基本';
  const version = config.version || 'v2.0';
  
  const functionCallTemplate = config.thinkingMode 
    ? FUNCTION_CALL_TEMPLATE 
    : SIMPLE_FUNCTION_CALL_TEMPLATE;
  
  let basePrompt = `你是一个${mode}的Markdown编辑器助手(${version})，支持LaTeX和${features}的内容操作。\n${functionCallTemplate}`;
  
  // 如果是Qwen模型且非思考模式，添加/no_think标志
  if (!config.thinkingMode && config.isQwenModel) {
    basePrompt = `/no_think\n${basePrompt}`;
  }
  
  // 如果是非思考模式，移除think标签
  if (!config.thinkingMode) {
    basePrompt = basePrompt.replace(/<think[^>]*>.*?<\/think>/gs, '').trim();
  }
  
  return basePrompt;
}

// 生成系统提示词（用于API调用）
export function generateSystemMessage(config: {
  thinkingMode: boolean;
  isQwenModel: boolean;
  version?: string;
}): string {
  return generateSystemPrompt({
    thinkingMode: config.thinkingMode,
    isQwenModel: config.isQwenModel,
    version: config.version || 'v2.0',
    features: []
  });
}
