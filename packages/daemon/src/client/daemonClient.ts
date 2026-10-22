import {
  type RequestEvent,
  type ResponseEvent,
  responseEventSchema,
  type SDKMessage,
} from "@claudin/events";

export type AgentResponseEvent = ResponseEvent<SDKMessage>;
export type ResponseListener = (response: AgentResponseEvent) => void;

export interface EventClient {
  send(request: RequestEvent): void;
  subscribe(listener: ResponseListener): () => void;
  close(): void;
}

export class DaemonClient implements EventClient {
  readonly listeners = new Set<ResponseListener>();

  private constructor(private socket: WebSocket) {
    socket.addEventListener("message", (event) => this.notifyListeners(String(event.data)));
  }

  static async connect(url: string): Promise<DaemonClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error(`Cannot reach ${url}`)), {
        once: true,
      });
    });
    return new DaemonClient(socket);
  }

  send(request: RequestEvent): void {
    this.socket.send(JSON.stringify(request));
  }

  subscribe(listener: ResponseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.socket.close();
  }

  notifyListeners(data: string): void {
    const response = responseEventSchema.parse(JSON.parse(data)) as AgentResponseEvent;
    for (const listener of this.listeners) listener(response);
  }
}
