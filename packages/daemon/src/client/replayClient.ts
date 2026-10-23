import { FileSessionStore, type RequestEvent, type StoredEvent } from "@claudin/events";
import { SESSIONS_DIRECTORY } from "../server/daemonContext.ts";
import type { DaemonEvent, DaemonEventListener, EventClient } from "./daemonClient.ts";

const MAX_GAP_MS = 1500;
const READ_ONLY_REASON = "Replay is read-only";
const PROMPT_TYPES = new Set(["agent.prompt.requested"]);

export class ReplayClient implements EventClient {
  readonly listeners = new Set<DaemonEventListener>();
  timer?: ReturnType<typeof setTimeout>;

  constructor(
    private stored: StoredEvent[],
    private speed = 1,
  ) {}

  static async load(
    sessionId: string,
    speed: number,
    store = new FileSessionStore(SESSIONS_DIRECTORY),
  ): Promise<ReplayClient> {
    const stored = await store.read(sessionId);
    if (stored.length === 0) throw new Error(`Unknown session: ${sessionId}`);
    return new ReplayClient(stored, speed);
  }

  send(request: RequestEvent): void {
    if (request.type === "session.sync.requested") return this.playFrom(0);
    if (PROMPT_TYPES.has(request.type)) {
      this.notify({ type: "request.failed", reason: READ_ONLY_REASON }, false);
    }
  }

  subscribe(listener: DaemonEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    clearTimeout(this.timer);
  }

  playFrom(index: number): void {
    const current = this.stored[index];
    if (!current) return;
    this.notify(current.event as DaemonEvent, true);
    const next = this.stored[index + 1];
    if (!next) return;
    const gap = Math.min((next.timestamp - current.timestamp) / this.speed, MAX_GAP_MS);
    this.timer = setTimeout(() => this.playFrom(index + 1), Math.max(gap, 0));
  }

  notify(event: DaemonEvent, peer: boolean): void {
    for (const listener of this.listeners) listener(event, peer);
  }
}
