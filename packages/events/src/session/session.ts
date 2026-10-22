import type { AppEvent } from "./appEvent.ts";
import { EventMachine, type Handler } from "./eventMachine.ts";
import { reduceTimedEvent } from "../reducers/reduceSessionState.ts";
import type { ResponseEvent } from "../responses/responseEvents.ts";
import { createSessionState, type SessionState } from "./sessionState.ts";
import type { SessionStore } from "./sessionStore.ts";

type RestoredEvent = Extract<ResponseEvent, { type: "session.restored" }>;

const TRANSIENT_TYPES = new Set(["session.restored", "session.list.received"]);

const isTransient = (event: AppEvent): boolean => TRANSIENT_TYPES.has(event.type);

export class Session {
  readonly id: string;
  machine: EventMachine<SessionState, AppEvent>;

  constructor(
    id: string,
    private store: SessionStore,
  ) {
    this.id = id;
    this.machine = new EventMachine(createSessionState(id), reduceTimedEvent);
  }

  get state(): SessionState {
    return this.machine.state;
  }

  async dispatch(event: AppEvent): Promise<void> {
    const at = Date.now();
    this.machine.send(event, at);
    if (!isTransient(event)) await this.store.append(this.id, event, at);
  }

  subscribe(listener: Handler<AppEvent>): () => void {
    return this.machine.subscribe(listener);
  }
}

export async function startSession(store: SessionStore): Promise<Session> {
  const session = new Session(crypto.randomUUID(), store);
  await session.dispatch({ type: "session.created", sessionId: session.id });
  return session;
}

export async function restoreSession(
  store: SessionStore,
  sessionId: string,
): Promise<{ session: Session; restored: RestoredEvent }> {
  const events = await store.read(sessionId);
  if (events.length === 0) throw new Error(`Unknown session: ${sessionId}`);
  const restored: RestoredEvent = { type: "session.restored", sessionId, events };
  const session = new Session(sessionId, store);
  await session.dispatch(restored);
  return { session, restored };
}
