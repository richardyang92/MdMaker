import React from 'react';
import type { AgentEvent } from '../../services/types/agent';

interface AgentEventItemProps {
  event: AgentEvent;
}

/** Renders a single agent event. Styling kept minimal/Tailwind to match codeact cards. */
export const AgentEventItem: React.FC<AgentEventItemProps> = ({ event }) => {
  switch (event.type) {
    case 'thought':
      return (
        <div className="my-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <span className="mr-1 font-semibold text-slate-400">思考:</span>
          {event.content}
        </div>
      );
    case 'tool_call':
      return (
        <div className="my-1 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
          <span className="mr-1 font-semibold text-blue-600 dark:text-blue-400">调用工具:</span>
          <code className="text-blue-800 dark:text-blue-200">{event.name}</code>
          <pre className="mt-1 overflow-x-auto text-xs text-slate-600 dark:text-slate-300">
            {JSON.stringify(event.args, null, 2)}
          </pre>
        </div>
      );
    case 'tool_result':
      return (
        <div
          className={`my-1 rounded border px-3 py-2 text-sm ${
            event.ok
              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
              : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
          }`}
        >
          <span className="mr-1 font-semibold">
            {event.ok ? '✓ 工具结果:' : '✗ 工具失败:'}
          </span>
          <span className="text-slate-700 dark:text-slate-200">{event.summary}</span>
        </div>
      );
    case 'document_patch':
      return (
        <div className="my-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950">
          <span className="mr-1 font-semibold text-amber-700 dark:text-amber-300">
            ✎ 文档已更新 (v{event.version}):
          </span>
          <span className="text-slate-700 dark:text-slate-200">{event.summary}</span>
        </div>
      );
    case 'final':
      return (
        <div className="my-2 rounded bg-slate-100 px-3 py-2 text-sm font-medium dark:bg-slate-800">
          {event.content}
        </div>
      );
    case 'error':
      return (
        <div className="my-1 rounded border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          错误: {event.error}
        </div>
      );
    case 'done':
      return null;
    default:
      return null;
  }
};
