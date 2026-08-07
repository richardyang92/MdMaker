import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi } from '../services/api/agentApi';
import { DocumentSync } from '../lib/documentSync';
import type {
  AgentEvent,
  CreateSessionResponse,
} from '../services/types/agent';

// A grouped run of events shown as one assistant turn in the UI.
export interface AgentTurn {
  id: string;
  /** 该轮用户发送的指令文本，用于在活动流中渲染用户消息气泡。 */
  userMessage: string;
  /**
   * 该轮附带的文档选区上下文（用户从渲染稿「加入上下文」的文本）。
   * 仅用于在历史气泡下回显一个只读标签；未附带时为 undefined。
   */
  selection?: string;
  events: AgentEvent[];
  status: 'streaming' | 'done' | 'error';
}

export interface UseAgentChatReturn {
  sessionId: string | null;
  turns: AgentTurn[];
  isRunning: boolean;
  error: string | null;
  documentVersion: number;
  sendMessage: (message: string, opts: SendMessageOpts) => Promise<void>;
  stop: () => void;
  ensureSession: (document: string, title: string) => Promise<void>;
  onUserEdit: () => void;
}

export interface SendMessageOpts {
  provider: string;
  model: string;
  selection?: string;
  /** Called when the agent emits a document_patch — editor applies new content. */
  onDocumentPatch: (version: number) => void;
  /** Read current document content (for sync). */
  getDocumentContent: () => string;
  /** Apply authoritative content (full replace). */
  setDocumentContent: (content: string) => void;
}

export function useAgentChat(): UseAgentChatReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentVersion, setDocumentVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const syncRef = useRef<DocumentSync | null>(null);
  const sessionRespRef = useRef<CreateSessionResponse | null>(null);

  const ensureSession = useCallback(async (document: string, title: string) => {
    if (sessionId) return;
    const resp = await agentApi.createSession({ document, title });
    sessionRespRef.current = resp;
    setSessionId(resp.session_id);
    setDocumentVersion(resp.version);
    syncRef.current = new DocumentSync({
      sessionId: resp.session_id,
      initialVersion: resp.version,
      getContent: () => document, // patched in sendMessage with live getters
      setContent: () => {},
    });
  }, [sessionId]);

  const sendMessage = useCallback(async (message: string, opts: SendMessageOpts) => {
    if (!sessionId) {
      setError('no session');
      return;
    }
    // Wire sync to live getters
    syncRef.current = new DocumentSync({
      sessionId,
      initialVersion: documentVersion,
      getContent: opts.getDocumentContent,
      setContent: opts.setDocumentContent,
    });

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setError(null);

    const turnId = `turn-${Date.now()}`;
    setTurns((prev) => [
      ...prev,
      {
        id: turnId,
        userMessage: message,
        selection: opts.selection,
        events: [],
        status: 'streaming',
      },
    ]);

    try {
      const stream = agentApi.sendMessage(
        sessionId,
        {
          message,
          provider: opts.provider,
          model: opts.model,
          selection: opts.selection,
        },
        controller.signal,
      );
      for await (const evt of stream) {
        setTurns((prev) =>
          prev.map((t) => {
            if (t.id !== turnId) return t;
            const events = [...t.events, evt];
            // Merge consecutive thought deltas into the previous thought event
            // so the UI renders one growing thought bubble instead of N small
            // ones. (Backend already coalesces into sentence-sized chunks, but
            // multiple chunks in one turn should still display as one block.)
            if (evt.type === 'thought' && events.length >= 2) {
              const prevEvt = events[events.length - 2];
              if (prevEvt.type === 'thought') {
                events.splice(events.length - 2, 2, {
                  type: 'thought',
                  content: prevEvt.content + evt.content,
                });
              }
            }
            return { ...t, events };
          }),
        );
        if (evt.type === 'document_patch') {
          setDocumentVersion(evt.version);
          // Notify editor to fetch + apply authoritative content
          opts.onDocumentPatch(evt.version);
        } else if (evt.type === 'error') {
          setError(evt.error);
          setTurns((prev) =>
            prev.map((t) => (t.id === turnId ? { ...t, status: 'error' } : t)),
          );
        } else if (evt.type === 'stopped') {
          setTurns((prev) =>
            prev.map((t) => (t.id === turnId ? { ...t, status: 'done' } : t)),
          );
        }
      }
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, status: 'done' } : t)),
      );
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message);
        setTurns((prev) =>
          prev.map((t) => (t.id === turnId ? { ...t, status: 'error' } : t)),
        );
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [sessionId, documentVersion]);

  const stop = useCallback(() => {
    // Signal the backend to interrupt the agent run cooperatively, then abort
    // the local SSE reader. The backend's `stopped` terminal event may not
    // arrive before the abort, so we also append a local stopped marker to the
    // active turn so the user always sees explicit stop feedback.
    if (sessionId) void agentApi.stop(sessionId);
    abortRef.current?.abort();
    setTurns((prev) =>
      prev.map((t, i) =>
        i === prev.length - 1 && t.status === 'streaming'
          ? { ...t, status: 'done', events: [...t.events, { type: 'stopped', content: '' }] }
          : t,
      ),
    );
    setIsRunning(false);
  }, [sessionId]);

  const onUserEdit = useCallback(() => {
    syncRef.current?.onUserEdit();
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      syncRef.current?.dispose();
    };
  }, []);

  return { sessionId, turns, isRunning, error, documentVersion, sendMessage, stop, ensureSession, onUserEdit };
}
