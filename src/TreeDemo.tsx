import React from 'react';
import TreeRenderer from './TreeRenderer';
import aiProviders from './ai-providers.json';

interface TreeDemoProps {
  onBack?: () => void;
}

const TreeDemo: React.FC<TreeDemoProps> = ({ onBack }) => {

  return (
    <div className="min-h-screen bg-gray-50 p-4 tree-demo-bg">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tree-demo-header">AI Provider信息</h1>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              返回编辑器
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow tree-panel">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 tree-panel-header">
            <h2 className="text-sm font-medium text-gray-700">AI Providers 数据</h2>
          </div>
          <div className="p-4">
            <TreeRenderer data={aiProviders} />
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow tree-panel">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 tree-panel-header">
            <h2 className="text-sm font-medium text-gray-700">原始JSON数据</h2>
          </div>
          <div className="p-4">
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-2">AI Providers</h3>
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto tree-pre">
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
