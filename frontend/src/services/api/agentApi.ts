/** Agent API client. */

import { API_ENDPOINTS } from './config';
import { parseSSEStream } from './aiApi';
import type {
  AgentEvent,
  ClientSyncRequest,
  ClientSyncResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  SendMessageRequest,
} from '../types/agent';

export const agentApi = {
  /** Create a new agent session with initial document content. */
  async createSession(req: CreateSessionRequest): Promise<CreateSessionResponse> {
    const resp = await fetch(API_ENDPOINTS.agentSessions(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!resp.ok) throw new Error(`createSession failed: ${resp.status}`);
    return resp.json();
  },

  /** Send a message and stream agent events. Accepts an AbortSignal for stop. */
  async *sendMessage(
    sessionId: string,
    req: SendMessageRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentEvent, void, unknown> {
    const resp = await fetch(API_ENDPOINTS.agentSessionMessages(sessionId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`sendMessage failed: ${resp.status} ${text}`);
    }
    const stream = parseSSEStream(resp) as AsyncGenerator<AgentEvent, void, unknown>;
    yield* stream;
  },

  /** Sync a client edit with optimistic locking. */
  async sync(sessionId: string, req: ClientSyncRequest): Promise<ClientSyncResponse> {
    const resp = await fetch(API_ENDPOINTS.agentSessionSync(sessionId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!resp.ok) throw new Error(`sync failed: ${resp.status}`);
    return resp.json();
  },

  /** Stop the current run. */
  async stop(sessionId: string): Promise<void> {
    await fetch(API_ENDPOINTS.agentSessionStop(sessionId), { method: 'POST' });
  },

  /** Delete a session. */
  async deleteSession(sessionId: string): Promise<void> {
    await fetch(API_ENDPOINTS.agentSession(sessionId), { method: 'DELETE' });
  },

  /** Fetch the authoritative document content for a session. */
  async getDocument(sessionId: string): Promise<{ content: string; title: string; version: number }> {
    const resp = await fetch(API_ENDPOINTS.agentSessionDocument(sessionId));
    if (!resp.ok) throw new Error(`getDocument failed: ${resp.status}`);
    return resp.json();
  },
};
