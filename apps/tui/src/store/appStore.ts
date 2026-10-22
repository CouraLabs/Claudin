import type { EventClient } from "@claudin/daemon/client";
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
  readonly stopListening: () => void;

  constructor(private client: EventClient) {
    this.stopListening = client.subscribe((response) => this.machine.send(response));
  }

  get state(): SessionState {
    return this.machine.state;
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

  subscribeEvents(listener: Handler<AppEvent>): () => void {
    return this.machine.subscribe(listener);
  }

  close(): void {
    this.stopListening();
    this.client.close();
  }
}
