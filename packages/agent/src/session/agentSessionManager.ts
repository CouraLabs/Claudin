import type {
  ForkSessionOptions,
  GetSessionInfoOptions,
  GetSessionMessagesOptions,
  Options,
} from "@anthropic-ai/claude-agent-sdk";
import { type AgentRuntime, sdkRuntime } from "../runtime/agentRuntime.ts";
import { AgentSession } from "./agentSession.ts";

export class AgentSessionManager {
  readonly sessions = new Map<string, AgentSession>();

  constructor(private runtime: AgentRuntime = sdkRuntime) {}

  getAgentSessionInfo(sessionId: string, options?: GetSessionInfoOptions) {
    return this.runtime.getInfo(sessionId, options);
  }

  getAgentSessionMessages(sessionId: string, options?: GetSessionMessagesOptions) {
    return this.runtime.getMessages(sessionId, options);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  createSession(options: Options = {}): string {
    const sessionId = options.sessionId ?? crypto.randomUUID();
    this.sessions.set(
      sessionId,
      new AgentSession(sessionId, { ...options, sessionId }, this.runtime),
    );
    return sessionId;
  }

  async resumeSession(sessionId: string, options: Options = {}): Promise<string> {
    if (!(await this.runtime.getInfo(sessionId)))
      return this.createSession({ ...options, sessionId });
    const resumed = new AgentSession(sessionId, { ...options, resume: sessionId }, this.runtime);
    this.sessions.set(sessionId, resumed);
    return sessionId;
  }

  async forkSession(
    sessionId: string,
    forkOptions?: ForkSessionOptions,
    options: Options = {},
  ): Promise<string> {
    const forked = await this.runtime.fork(sessionId, forkOptions);
    return this.resumeSession(forked.sessionId, options);
  }

  closeSession(sessionId: string): void {
    this.sessions.get(sessionId)?.close();
    this.sessions.delete(sessionId);
  }

  closeAll(): void {
    for (const sessionId of [...this.sessions.keys()]) this.closeSession(sessionId);
  }

  requireSession(sessionId: string): AgentSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Unknown agent session: ${sessionId}`);
    return session;
  }
}
