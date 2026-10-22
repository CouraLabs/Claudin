import type { DaemonEvent, EventClient } from "@claudin/daemon/client";
import {
  type AppEvent,
  createSessionState,
  EventMachine,
  type Handler,
  type RequestEvent,
  reduceTimedEvent,
  type SessionState,
  type UiEvent,
} from "@claudin/events";

export type StateListener = (state: SessionState) => void;

export class AppStore {
  readonly machine = new EventMachine<SessionState, AppEvent>(
    createSessionState(""),
    reduceTimedEvent,
  );
  readonly peerEvents = new WeakSet<AppEvent>();
  readonly stopListening: () => void;

  constructor(private client: EventClient) {
    this.stopListening = client.subscribe((event, peer) => this.receive(event, peer));
  }

  get state(): SessionState {
    return this.machine.state;
  }

  receive(event: DaemonEvent, peer: boolean): void {
    if (peer) this.peerEvents.add(event);
    this.machine.send(event);
  }

  request(event: RequestEvent): void {
    this.machine.send(event);
    this.client.send(event);
  }

  emit(event: UiEvent): void {
    this.machine.send(event);
  }

  subscribe(listener: StateListener): () => void {
    return this.machine.subscribe(() => listener(this.machine.state));
  }

  subscribeOwnEvents(listener: Handler<AppEvent>): () => void {
    return this.machine.subscribe((event) => {
      if (!this.peerEvents.has(event)) listener(event);
    });
  }

  close(): void {
    this.stopListening();
    this.client.close();
  }
}
