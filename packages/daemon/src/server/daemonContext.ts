import { homedir } from "node:os";
import { join } from "node:path";
import { AgentSessionManager } from "@claudin/agent";
import {
  FileSessionStore,
  type ResponseEvent,
  restoreSession,
  Session,
  type SessionStore,
  startSession,
} from "@claudin/events";
import { OPTIONS_PATH } from "../persistence/optionsFile.ts";
import { isDirectory, resolveUserPath } from "../workspace/resolvePath.ts";

export const SESSIONS_DIRECTORY = join(homedir(), ".claudin", "sessions");

type CreatedEvent = Extract<ResponseEvent, { type: "session.created" }>;
type RestoredEvent = Extract<ResponseEvent, { type: "session.restored" }>;
type ForkedEvent = Extract<ResponseEvent, { type: "session.forked" }>;

export async function requireStoredDirectory(cwd: string): Promise<void> {
  if (!(await isDirectory(cwd))) throw new Error(`Session directory no longer exists: ${cwd}`);
}

export class DaemonContext {
  constructor(
    public session: Session,
    readonly store: SessionStore,
    public agents: AgentSessionManager,
    public cwd: string,
    readonly optionsPath: string,
  ) {}

  startFreshSession(cwd = this.cwd): CreatedEvent {
    this.agents.closeAll();
    this.cwd = cwd;
    this.session = new Session(crypto.randomUUID(), this.store);
    return { type: "session.created", sessionId: this.session.id };
  }

  async restoreStoredSession(sessionId: string): Promise<RestoredEvent> {
    const { session, restored } = await restoreSession(this.store, sessionId);
    const cwd = session.state.cwd || this.cwd;
    await requireStoredDirectory(cwd);
    this.agents.closeAll();
    this.cwd = cwd;
    this.session = session;
    return restored;
  }

  async forkCurrentSession(): Promise<ForkedEvent> {
    const events = await this.store.read(this.session.id);
    this.agents.closeAll();
    const forked = new Session(crypto.randomUUID(), this.store);
    await this.store.copy(this.session.id, forked.id);
    this.session = forked;
    return { type: "session.forked", sessionId: forked.id, events };
  }

  async changeDirectory(path: string): Promise<{ cwd: string; created: CreatedEvent }> {
    const cwd = resolveUserPath(this.cwd, path);
    if (!(await isDirectory(cwd))) throw new Error(`Not a directory: ${cwd}`);
    return { cwd, created: this.startFreshSession(cwd) };
  }
}

async function openSession(store: SessionStore, resumeSessionId?: string) {
  if (!resumeSessionId) return { session: await startSession(store), cwd: process.cwd() };
  const { session } = await restoreSession(store, resumeSessionId);
  const cwd = session.state.cwd || process.cwd();
  await requireStoredDirectory(cwd);
  return { session, cwd };
}

export async function createDaemonContext(
  store: SessionStore = new FileSessionStore(SESSIONS_DIRECTORY),
  resumeSessionId?: string,
  optionsPath = OPTIONS_PATH,
): Promise<DaemonContext> {
  const { session, cwd } = await openSession(store, resumeSessionId);
  return new DaemonContext(session, store, new AgentSessionManager(), cwd, optionsPath);
}
