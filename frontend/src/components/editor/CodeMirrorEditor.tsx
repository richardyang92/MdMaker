import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState, Extension, StateEffect } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { indentOnInput, bracketMatching, foldGutter, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { getThemeExtension } from './themes';
import './Editor.css';

export interface CodeMirrorEditorRef {
  getView: () => EditorView | null;
  getSelection: () => { start: number; end: number; text: string } | null;
  setCursorPosition: (position: number) => void;
  getScrollInfo: () => { scrollTop: number; scrollHeight: number; clientHeight: number };
  scrollTo: (top: number) => void;
  insertText: (text: string, from?: number, to?: number) => void;
  getContent: () => string;
}

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  theme: 'light' | 'dark' | 'eye-protect';
  onScroll?: (scrollTop: number, scrollRatio: number) => void;
  placeholder?: string;
  className?: string;
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorRef, CodeMirrorEditorProps>(
  ({ value, onChange, theme, onScroll, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onScrollRef = useRef(onScroll);
    const themeRef = useRef(theme);

    // 保持回调最新
    useEffect(() => {
      onChangeRef.current = onChange;
      onScrollRef.current = onScroll;
    }, [onChange, onScroll]);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      getView: () => viewRef.current,
      getSelection: () => {
        const view = viewRef.current;
        if (!view) return null;
        const selection = view.state.selection.main;
        const text = view.state.sliceDoc(selection.from, selection.to);
        return { start: selection.from, end: selection.to, text };
      },
      setCursorPosition: (position: number) => {
        const view = viewRef.current;
        if (view) {
          view.dispatch({
            selection: { anchor: position },
            scrollIntoView: true
          });
          view.focus();
        }
      },
      getScrollInfo: () => {
        const view = viewRef.current;
        if (!view) return { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
        const scrollDOM = view.scrollDOM;
        return {
          scrollTop: scrollDOM.scrollTop,
          scrollHeight: scrollDOM.scrollHeight,
          clientHeight: scrollDOM.clientHeight
        };
      },
      scrollTo: (top: number) => {
        const view = viewRef.current;
        if (view) {
          view.scrollDOM.scrollTop = top;
        }
      },
      insertText: (text: string, from?: number, to?: number) => {
        const view = viewRef.current;
        if (view) {
          const f = from ?? view.state.selection.main.from;
          const t = to ?? view.state.selection.main.to;
          view.dispatch({
            changes: { from: f, to: t, insert: text },
            selection: { anchor: f + text.length }
          });
        }
      },
      getContent: () => {
        const view = viewRef.current;
        return view ? view.state.doc.toString() : '';
      }
    }), []);

    // 初始化编辑器
    useEffect(() => {
      if (!containerRef.current) return;

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      });

      const extensions: Extension[] = [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        dropCursor(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        foldGutter(),
        EditorView.lineWrapping,
        getThemeExtension(theme),
        updateListener,
        EditorView.editable.of(true)
      ];

      const state = EditorState.create({
        doc: value,
        extensions
      });

      const view = new EditorView({
        state,
        parent: containerRef.current
      });

      viewRef.current = view;

      // 直接监听 scrollDOM 的滚动事件
      const handleScroll = () => {
        const scrollDOM = view.scrollDOM;
        const maxScroll = scrollDOM.scrollHeight - scrollDOM.clientHeight;
        const scrollRatio = maxScroll > 0 ? scrollDOM.scrollTop / maxScroll : 0;
        onScrollRef.current?.(scrollDOM.scrollTop, scrollRatio);
      };

      view.scrollDOM.addEventListener('scroll', handleScroll);

      return () => {
        view.scrollDOM.removeEventListener('scroll', handleScroll);
        view.destroy();
        viewRef.current = null;
      };
    }, []); // 只在挂载时初始化

    // 更新内容（外部value变化时）
    useEffect(() => {
      const view = viewRef.current;
      if (view && view.state.doc.toString() !== value) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: value }
        });
      }
    }, [value]);

    // 更新主题
    useEffect(() => {
      const view = viewRef.current;
      if (view && themeRef.current !== theme) {
        themeRef.current = theme;
        view.dispatch({
          effects: StateEffect.reconfigure.of([getThemeExtension(theme)])
        });
      }
    }, [theme]);

    return (
      <div
        ref={containerRef}
        className={`codemirror-editor-container ${className || ''}`}
      />
    );
  }
);

CodeMirrorEditor.displayName = 'CodeMirrorEditor';
