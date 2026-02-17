import React, { useState } from 'react';

interface TreeNodeProps {
  data: any;
  name?: string;
  isLast?: boolean;
  isRoot?: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({ data, name, isRoot = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  // 判断是否为简单值（字符串、数字、布尔值、null）
  const isSimpleValue = (value: any): boolean => {
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value === undefined
    );
  };
  
  // 判断是否为数组
  const isArray = Array.isArray(data);
  
  // 判断是否为对象
  const isObject = typeof data === 'object' && data !== null && !isArray;
  
  // 渲染简单值
  const renderSimpleValue = (value: any) => {
    if (value === null) return <span className="text-gray-400 dark:text-gray-500 italic">null</span>;
    if (value === undefined) return <span className="text-gray-400 dark:text-gray-500 italic">undefined</span>;
    if (typeof value === 'string') return <span className="text-emerald-600 dark:text-emerald-400 tree-string font-mono">"{value}"</span>;
    if (typeof value === 'number') return <span className="text-sky-600 dark:text-sky-400 tree-number font-mono">{value}</span>;
    if (typeof value === 'boolean') return <span className="text-purple-600 dark:text-purple-400 tree-boolean font-mono">{value.toString()}</span>;
    return <span className="font-mono">{String(value)}</span>;
  };
  
  // 渲染对象或数组的子节点
  const renderChildren = () => {
    if (!isExpanded) return null;
    
    if (isArray) {
      return (
        <div className="ml-5">
          {data.map((item: any, index: number) => (
            <TreeNode
              key={index}
              data={item}
              name={index.toString()}
              isLast={index === data.length - 1}
            />
          ))}
        </div>
      );
    }
    
    if (isObject) {
      const keys = Object.keys(data);
      return (
        <div className="ml-5">
          {keys.map((key, index) => (
            <TreeNode
              key={key}
              data={data[key]}
              name={key}
              isLast={index === keys.length - 1}
            />
          ))}
        </div>
      );
    }
    
    return null;
  };
  
  // 获取节点类型图标
  const getTypeIcon = () => {
    if (isArray) return '[]';
    if (isObject) return '{}';
    return '';
  };
  
  // 获取节点值的显示
  const getValueDisplay = () => {
    if (isArray) return `Array(${data.length})`;
    if (isObject) return 'Object';
    return renderSimpleValue(data);
  };
  
  // 渲染节点内容
  const renderNodeContent = () => {
    if (isSimpleValue(data)) {
      return (
        <div className="flex items-start py-1">
          {name && <span className="text-gray-700 dark:text-gray-300 mr-2 font-medium mt-1">{name}:</span>}
          {renderSimpleValue(data)}
        </div>
      );
    }
    
    return (
      <div 
        className="flex items-start cursor-pointer hover:bg-white/10 dark:hover:bg-gray-700/30 px-2 py-1 rounded-lg transition-all duration-200 group"
        onClick={(e) => {
          e.stopPropagation();
          toggleExpanded();
        }}
      >
        <span className="text-gray-400 dark:text-gray-500 mr-2 text-xs w-4 mt-1 transition-transform duration-200 group-hover:text-gray-300 dark:group-hover:text-gray-400">
          {isExpanded ? '▼' : '▶'}
        </span>
        {name && <span className="text-gray-700 dark:text-gray-300 mr-2 font-semibold mt-1">{name}:</span>}
        <span className="text-gray-400 dark:text-gray-500 mr-2 text-xs mt-1 opacity-70">{getTypeIcon()}</span>
        <span className="font-medium mt-1">{getValueDisplay()}</span>
      </div>
    );
  };
  
  if (isRoot) {
    return (
      <div className="font-mono text-sm">
        {renderChildren()}
      </div>
    );
  }
  
  return (
    <div className="py-0.5">
      <div className="flex">
        <div className="flex-1">
          {renderNodeContent()}
        </div>
      </div>
      {renderChildren()}
    </div>
  );
};

interface TreeRendererProps {
  data: any;
  className?: string;
}

const TreeRenderer: React.FC<TreeRendererProps> = ({ data, className = '' }) => {
  return (
    <div className={`bg-transparent ${className}`}>
      <TreeNode data={data} isRoot={true} />
    </div>
  );
};

export default TreeRenderer;
