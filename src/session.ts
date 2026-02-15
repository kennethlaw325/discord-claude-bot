export class SessionManager {
  private sessions = new Map<string, string>();

  get(threadId: string): string | undefined {
    return this.sessions.get(threadId);
  }

  set(threadId: string, sessionId: string): void {
    this.sessions.set(threadId, sessionId);
  }

  delete(threadId: string): void {
    this.sessions.delete(threadId);
  }
}
