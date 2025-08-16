import React from 'react';
import TreeRenderer from './TreeRenderer';
import aiProviders from './ai-providers.json';

interface TreeDemoProps {
  onBack?: () => void;
}

const TreeDemo: React.FC<TreeDemoProps> = ({ onBack }) => {

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 tree-demo-bg">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tree-demo-header">AI Provider信息</h1>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200"
            >
              返回编辑器
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow tree-panel">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 tree-panel-header">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Providers 数据</h2>
          </div>
          <div className="p-4">
            <TreeRenderer data={aiProviders} />
          </div>
        </div>

        <div className="mt-6 bg-white dark:bg-slate-800 rounded-lg shadow tree-panel">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 tree-panel-header">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">原始JSON数据</h2>
          </div>
          <div className="p-4">
            <div>
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">AI Providers</h3>
              <pre className="text-xs bg-gray-100 dark:bg-slate-700 p-3 rounded overflow-x-auto tree-pre dark:text-gray-300">
                {JSON.stringify(aiProviders, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreeDemo;
