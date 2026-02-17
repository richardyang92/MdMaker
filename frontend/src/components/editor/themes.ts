import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

// 亮色主题
export const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    height: '100%'
  },
  '.cm-content': {
    caretColor: 'var(--accent-primary)',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '14px',
    lineHeight: '1.6',
    padding: '16px 0'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--accent-primary)'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-tertiary)',
    border: 'none',
    borderRight: '1px solid var(--border-color)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--bg-tertiary)'
  },
  '.cm-selectionMatch': {
    backgroundColor: 'var(--accent-light, rgba(59, 130, 246, 0.2))'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(99, 102, 241, 0.25) !important'
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--bg-tertiary, rgba(0, 0, 0, 0.04))'
  },
  '.cm-scroller': {
    overflow: 'auto'
  }
}, { dark: false });

// 深色主题
export const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4'
  },
  '.cm-content': {
    caretColor: '#569cd6',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '14px',
    lineHeight: '1.6',
    padding: '16px 0'
  },
  '.cm-cursor': {
    borderLeftColor: '#569cd6'
  },
  '.cm-gutters': {
    backgroundColor: '#252526',
    color: '#858585',
    border: 'none',
    borderRight: '1px solid #404040'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#37373d'
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(86, 156, 214, 0.3)'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(86, 156, 214, 0.3) !important'
  },
  '.cm-activeLine': {
    backgroundColor: '#37373d'
  },
  '.cm-scroller': {
    overflow: 'auto'
  },
  // Markdown 语法高亮
  '.cm-header': { color: '#569cd6', fontWeight: 'bold' },
  '.cm-header-1': { fontSize: '1.6em' },
  '.cm-header-2': { fontSize: '1.4em' },
  '.cm-header-3': { fontSize: '1.2em' },
  '.cm-strong': { color: '#ce9178', fontWeight: 'bold' },
  '.cm-em': { color: '#ce9178', fontStyle: 'italic' },
  '.cm-link': { color: '#569cd6' },
  '.cm-url': { color: '#ce9178' },
  '.cm-quote': { color: '#6a9955', fontStyle: 'italic' }
}, { dark: true });

// 护眼主题
export const eyeProtectTheme = EditorView.theme({
  '&': {
    backgroundColor: '#f5f0e6',
    color: '#3d3d3d'
  },
  '.cm-content': {
    caretColor: '#7c9473',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '14px',
    lineHeight: '1.6',
    padding: '16px 0'
  },
  '.cm-cursor': {
    borderLeftColor: '#7c9473'
  },
  '.cm-gutters': {
    backgroundColor: '#ebe6dc',
    color: '#8b8b8b',
    border: 'none',
    borderRight: '1px solid #d9d4ca'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#e5e0d6'
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(124, 148, 115, 0.3)'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(124, 148, 115, 0.3) !important'
  },
  '.cm-activeLine': {
    backgroundColor: '#e5e0d6'
  },
  '.cm-scroller': {
    overflow: 'auto'
  },
  // Markdown 语法高亮
  '.cm-header': { color: '#5a7c5f', fontWeight: 'bold' },
  '.cm-header-1': { fontSize: '1.6em' },
  '.cm-header-2': { fontSize: '1.4em' },
  '.cm-header-3': { fontSize: '1.2em' },
  '.cm-strong': { color: '#8b6f47', fontWeight: 'bold' },
  '.cm-em': { color: '#8b6f47', fontStyle: 'italic' },
  '.cm-link': { color: '#5a7c5f' },
  '.cm-url': { color: '#8b6f47' },
  '.cm-quote': { color: '#7c9473', fontStyle: 'italic' }
}, { dark: false });

export const getThemeExtension = (theme: 'light' | 'dark' | 'eye-protect'): Extension => {
  switch (theme) {
    case 'dark':
      return darkTheme;
    case 'eye-protect':
      return eyeProtectTheme;
    default:
      return lightTheme;
  }
};
