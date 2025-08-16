import React, { useState } from 'react';
import TreeRenderer from './TreeRenderer';

interface Message {
  role: string;
  content: string;
  id: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

interface MessageItemProps {
  message: Message;
  onApplyResponse: (content: string, mode: 'replace' | 'append' | 'insert' | 'replace_selection') => void;
  requestParams?: any;
  executedOperations: Record<string, boolean>;
  setExecutedOperations: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  resetExecutedOperation: (messageId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onApplyResponse, requestParams, executedOperations, setExecutedOperations }) => {
  const [showRaw, setShowRaw] = useState(false);
  const [showRequestParamsRaw, setShowRequestParamsRaw] = useState(false);
  
  // 解析消息中的各种标记
  const hasThink = message.content.includes('think>');
  const thinkMatch = message.content.match(/<think(?:\s+version="(\d+\.\d+)")?>([\s\S]*?)<\/think>/);
  const contextMatch = message.content.match(/<context>([\s\S]*?)<\/context>/g);
  const suggestionMatch = message.content.match(/<suggestion>([\s\S]*?)<\/suggestion>/g);
  const errorMatch = message.content.match(/<error>([\s\S]*?)<\/error>/g);
  
  // 移除所有标记获取主内容
  const mainContent = message.content
    .replace(/<think(?:\s+version="\d+\.\d+")?>[\s\S]*?<\/think>/, '')
    .replace(/<context>[\s\S]*?<\/context>/g, '')
    .replace(/<suggestion>[\s\S]*?<\/suggestion>/g, '')
    .replace(/<error>[\s\S]*?<\/error>/g, '')
    .trim();
  
  // 检查是否是流式响应消息（ID以stream-开头）
  const isStreaming = message.id.startsWith('stream-');
  // 检查流式响应是否已完成（不是流式消息或者内容不为空）
  const isStreamingComplete = !isStreaming || (isStreaming && message.content.length > 0 && !message.content.endsWith('\n'));

  // 解析function call
  const parseFunctionCall = (content: string) => {
    try {
      // 查找function call标记
      const functionCallMatch = content.match(/<function_call>([\s\S]*?)<\/function_call>/);
      if (functionCallMatch) {
        const functionCallContent = functionCallMatch[1].trim();
        // 解析JSON格式的function call
        let functionCall = JSON.parse(functionCallContent);
        
        // 处理不规范的arguments格式（直接是字符串而不是对象）
        if (functionCall.arguments && typeof functionCall.arguments === 'string') {
          functionCall.arguments = {
            content: functionCall.arguments
          };
        }
        
        return functionCall;
      }
      return null;
    } catch (error) {
      console.error('解析function call失败:', error);
      return null;
    }
  };

  // 执行function call
  const executeFunctionCall = (functionCall: any) => {
    // 立即标记操作已执行，防止连续点击
    if (executedOperations[message.id]) {
      return; // 如果已经执行过，直接返回
    }
    
    // 标记操作已执行
    setExecutedOperations(prev => ({
      ...prev,
      [message.id]: true
    }));
    
    // 根据function call的名称执行不同的操作
    switch (functionCall.name) {
      case 'replace_content':
        onApplyResponse(functionCall.arguments.content || mainContent, 'replace');
        break;
      case 'append_content':
        onApplyResponse(functionCall.arguments.content || mainContent, 'append');
        break;
      case 'insert_content':
        onApplyResponse(functionCall.arguments.content || mainContent, 'insert');
        break;
      case 'replace_selection':
        // 新增功能：替换选中的区域内容
        onApplyResponse(functionCall.arguments.content || mainContent, 'replace_selection');
        break;
      default:
        // 默认情况下，使用原始内容和模式
        onApplyResponse(mainContent, 'append');
        break;
    }
  };

  // 解析消息中的function call
  const functionCall = parseFunctionCall(message.content);

  // 检测并解析JSON
  const parseJSONContent = (content: string) => {
    const jsonMatches = [];
    
    // 查找代码块中的JSON，支持多种语言标识
    const codeBlockRegex = /```(?:json|javascript|js)?\s*([\s\S]*?)\s*```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      try {
        const jsonString = match[1].trim();
        if (jsonString) {
          // 尝试解析JSON
          const parsed = JSON.parse(jsonString);
          // 确保解析结果是对象或数组
          if (typeof parsed === 'object' && parsed !== null) {
            jsonMatches.push({
              fullMatch: match[0],
              json: parsed,
              startIndex: match.index,
              endIndex: match.index + match[0].length,
              type: 'codeblock'
            });
          }
        }
      } catch (e) {
        // 不是有效的JSON，跳过
        continue;
      }
    }
    
    // 查找function call中的JSON
    const functionCallRegex = /<function_call>([\s\S]*?)<\/function_call>/g;
    let funcMatch;
    
    while ((funcMatch = functionCallRegex.exec(content)) !== null) {
      try {
        const jsonString = funcMatch[1].trim();
        if (jsonString) {
          // 尝试解析JSON
          const parsed = JSON.parse(jsonString);
          // 确保解析结果是对象或数组
          if (typeof parsed === 'object' && parsed !== null) {
            jsonMatches.push({
              fullMatch: funcMatch[0],
              json: parsed,
              startIndex: funcMatch.index,
              endIndex: funcMatch.index + funcMatch[0].length,
              type: 'function_call'
            });
          }
        }
      } catch (e) {
        // 不是有效的JSON，跳过
        continue;
      }
    }
    
    return jsonMatches;
  };

  // 渲染带JSON的内容
  const renderContentWithJSON = (content: string) => {
    const jsonMatches = parseJSONContent(content);
    
    if (jsonMatches.length === 0) {
      return <div className="whitespace-pre-wrap leading-relaxed dark:text-gray-200">{content}</div>;
    }
    
    const elements = [];
    let lastIndex = 0;
    
    jsonMatches.forEach((jsonMatch, index) => {
      // 添加JSON之前的文本
      if (jsonMatch.startIndex > lastIndex) {
        elements.push(
          <span key={`text-${index}`} className="leading-relaxed dark:text-gray-200">
            {content.substring(lastIndex, jsonMatch.startIndex)}
          </span>
        );
      }
      
      // 添加JSON组件
      elements.push(
        <div key={`json-${index}`} className="my-3">
          <div className="bg-gradient-to-br from-gray-50/80 to-gray-100/60 dark:from-gray-800/80 dark:to-gray-700/60 rounded-xl border border-gray-200/50 dark:border-gray-600/50 shadow-sm backdrop-blur-sm">
            <div className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200/50 dark:border-gray-600/50 flex items-center">
              <span className="mr-2">📊</span>
              JSON数据
            </div>
            <div className="p-4">
              <TreeRenderer data={jsonMatch.json} />
            </div>
          </div>
        </div>
      );
      
      lastIndex = jsonMatch.endIndex;
    });
    
    // 添加最后的文本
    if (lastIndex < content.length) {
      elements.push(
        <span key="text-end" className="leading-relaxed dark:text-gray-200">
          {content.substring(lastIndex)}
        </span>
      );
    }
    
    return <div className="whitespace-pre-wrap dark:text-gray-200">{elements}</div>;
  };

  return (
    <div className={`text-sm ${message.role === 'user' ? 'text-right' : 'text-left'} mb-4`}>
      {/* 头像和名称 */}
      <div className={`flex items-center mb-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        {message.role === 'user' ? (
          <>
            <div>
              <div className="font-semibold text-gray-700 dark:text-gray-300 text-xs">用户</div>
            </div>
            <div className="ml-3 border border-indigo-100 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              U
            </div>
          </>
        ) : (
          <>
            <div className="border border-indigo-100 w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
              🤖
            </div>
            <div className="ml-3">
              <div className="font-semibold text-gray-700 dark:text-gray-300 text-xs">AI助手</div>
            </div>
          </>
        )}
      </div>
      
      <div className={`inline-block px-4 py-3 rounded-2xl max-w-full transition-all duration-300 hover:shadow-lg ${message.role === 'user' 
        ? 'message-user ml-auto bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md hover:shadow-xl' 
        : 'message-assistant mr-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 shadow-md hover:shadow-xl border border-gray-200 dark:border-gray-600'}`}>
        <>
          {/* 显示思考过程和上下文 */}
          {hasThink && thinkMatch && (
            <details className="mb-3">
              <summary className="cursor-pointer text-xs font-medium opacity-80 hover:opacity-100 transition-opacity duration-200">
                💭 思考过程 {thinkMatch[1] && `(v${thinkMatch[1]})`}
              </summary>
              <div className="mt-2 p-3 bg-gray-100/10 dark:bg-gray-800/20 rounded-xl text-xs whitespace-pre-wrap backdrop-blur-sm">
                {thinkMatch[2].trim()}
                {contextMatch && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <h4 className="font-semibold mb-2">📋 上下文:</h4>
                    {contextMatch.map((ctx, i) => (
                      <div key={i} className="mt-1 opacity-90">{ctx.replace(/<\/?context>/g, '')}</div>
                    ))}
                  </div>
                )}
                {suggestionMatch && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <h4 className="font-semibold mb-2">💡 建议:</h4>
                    {suggestionMatch.map((sug, i) => (
                      <div key={i} className="mt-1 opacity-90">{sug.replace(/<\/?suggestion>/g, '')}</div>
                    ))}
                  </div>
                )}
                {errorMatch && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <h4 className="font-semibold mb-2 text-red-300">⚠️ 错误:</h4>
                    {errorMatch.map((err, i) => (
                      <div key={i} className="mt-1 text-red-200">{err.replace(/<\/?error>/g, '')}</div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}
          <div className="mb-2">
            <button
              onClick={() => {
                setShowRaw(!showRaw);
                setShowRequestParamsRaw(!showRequestParamsRaw);
              }}
              className="text-sm opacity-70 hover:opacity-100 underline transition-opacity duration-200 bg-transparent border-none p-0 m-0"
            >
              {showRaw ? '👁️ 显示渲染' : '📝 显示原始'}
            </button>
          </div>
          {showRaw ? (
            <pre className="whitespace-pre-wrap text-xs bg-gray-900/10 dark:bg-gray-100/10 p-3 rounded-xl font-mono">{mainContent}</pre>
          ) : (
            // 只对已完成的消息进行JSON检测和渲染
            isStreamingComplete ? renderContentWithJSON(mainContent) : <div className="whitespace-pre-wrap leading-relaxed dark:text-gray-200">{mainContent}</div>
          )}
          
          {/* 显示function call执行按钮 */}
          {functionCall && (
            <div className="mt-4 pt-3 border-t border-white/20">
              <button
                onClick={() => executeFunctionCall(functionCall)}
                disabled={executedOperations[message.id]}
                className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 transform hover:scale-105 ${
                  executedOperations[message.id]
                    ? 'bg-gray-400/20 text-gray-400 cursor-not-allowed backdrop-blur-sm' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg hover:from-green-600 hover:to-emerald-600 hover:shadow-xl active:scale-95'
                }`}
              >
                {executedOperations[message.id] ? '✅ 已执行' : '⚡ 执行操作'}
              </button>
              <div className="mt-2 text-xs opacity-75">
                <span className="font-medium">操作类型:</span> {functionCall.name}
              </div>
            </div>
          )}
          
          {/* 流式响应指示器 */}
          {isStreaming && !isStreamingComplete && (
            <div className="flex items-center mt-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-pulse delay-150"></div>
              </div>
              <span className="text-xs opacity-70 ml-3 animate-pulse">AI正在思考中...</span>
            </div>
          )}
          
          {/* 显示请求参数 */}
          {message.role === 'user' && requestParams && (
            <div className="text-left mt-3">
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium opacity-80 hover:opacity-100 transition-opacity duration-200 flex items-center">
                  <span className="mr-1 group-open:rotate-90 transition-transform duration-200">▶</span>
                  🔧 显示请求参数
                </summary>
                <div className="mt-2 p-3 bg-gray-100/10 dark:bg-gray-800/20 rounded-xl backdrop-blur-sm">
                  {showRequestParamsRaw ? (
                    <pre className="whitespace-pre-wrap text-xs bg-gray-900/10 dark:bg-gray-100/10 p-3 rounded-xl font-mono">
                      {JSON.stringify(requestParams, null, 2)}
                    </pre>
                  ) : (
                    <TreeRenderer data={requestParams} />
                  )}
                </div>
              </details>
            </div>
          )}
          
        </>
      </div>
    </div>
  );
};

export default MessageItem;
