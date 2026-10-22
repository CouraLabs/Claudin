export type Handler<E> = (event: E) => void;

export class EventMachine<S, E> {
  #state: S;
  listeners = new Set<Handler<E>>();

  constructor(
    initial: S,
    private reducer: (state: S, event: E, at: number) => S,
  ) {
    this.#state = initial;
  }

  get state(): S {
    return this.#state;
  }

  send(event: E, at = Date.now()): void {
    this.#state = this.reducer(this.#state, event, at);
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: Handler<E>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
