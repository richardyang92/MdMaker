import { agentApi } from '../services/api/agentApi';

/**
 * Document state synchronizer between frontend editor and backend Workspace.
 *
 * Responsibilities:
 *  - Track the latest document version acknowledged by the backend.
 *  - Debounce user edits and send them to /sync with optimistic locking.
 *  - Apply document_patch events from the agent (full-content replace).
 *  - On version conflict, the backend returns its authoritative content.
 *
 * NOTE: This is a plain class (not a React hook) so it can be driven from
 * useAgentChat and also call back into the editor imperatively.
 */
export class DocumentSync {
  private sessionId: string;
  private version: number;
  private getContent: () => string;
  private setContent: (content: string) => void;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isApplyingPatch = false;

  constructor(opts: {
    sessionId: string;
    initialVersion: number;
    getContent: () => string;
    setContent: (content: string) => void;
  }) {
    this.sessionId = opts.sessionId;
    this.version = opts.initialVersion;
    this.getContent = opts.getContent;
    this.setContent = opts.setContent;
  }

  /** Called by the editor onChange (user typing). Debounced sync to backend. */
  onUserEdit(): void {
    if (this.isApplyingPatch) return; // ignore edits triggered by patch application
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.syncToBackend();
    }, 800);
  }

  /** Apply an incoming agent patch (full-content replace + new version). */
  applyPatch(version: number, content: string): void {
    this.isApplyingPatch = true;
    this.version = version;
    this.setContent(content);
    // release the guard on next tick so the onChange triggered by setContent is ignored
    setTimeout(() => {
      this.isApplyingPatch = false;
    }, 0);
  }

  private async syncToBackend(): Promise<void> {
    try {
      const resp = await agentApi.sync(this.sessionId, {
        base_version: this.version,
        content: this.getContent(),
      });
      if (resp.status === 'ok') {
        this.version = resp.version;
      } else {
        // Conflict: backend won. Adopt authoritative content.
        this.version = resp.version;
        this.applyPatch(resp.version, resp.content);
      }
    } catch (e) {
      // Network errors are non-fatal; next edit will retry.
      console.error('documentSync sync failed:', e);
    }
  }

  dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}
