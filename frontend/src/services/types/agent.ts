// Agent SSE event types (mirror backend /api/v1/agent)
// Backend source: backend/app/services/agent/translator.py + service.py

export type AgentEventType =
  | 'thought'
  | 'tool_call'
  | 'tool_result'
  | 'document_patch'
  | 'final'
  | 'stopped'
  | 'error'
  | 'done';

export interface ThoughtEvent {
  type: 'thought';
  content: string;
}

export interface ToolCallEvent {
  type: 'tool_call';
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: 'tool_result';
  name: string;
  ok: boolean;
  summary: string;
}

export interface DocumentPatchEvent {
  type: 'document_patch';
  version: number;
  summary: string;
}

export interface FinalEvent {
  type: 'final';
  content: string;
}

export interface StoppedEvent {
  type: 'stopped';
  content: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export interface DoneEvent {
  type: 'done';
  content: string;
}

export type AgentEvent =
  | ThoughtEvent
  | ToolCallEvent
  | ToolResultEvent
  | DocumentPatchEvent
  | FinalEvent
  | StoppedEvent
  | ErrorEvent
  | DoneEvent;

// Request types
export interface CreateSessionRequest {
  document: string;
  title: string;
}

export interface CreateSessionResponse {
  session_id: string;
  version: number;
  title: string;
}

export interface SendMessageRequest {
  message: string;
  provider: string;
  model: string;
  selection?: string;
  cursor_position?: number;
}

export interface ClientSyncRequest {
  base_version: number;
  content: string;
}

export interface ClientSyncResponse {
  status: 'ok' | 'conflict';
  version: number;
  content: string;
  title: string;
}
