import {
  daemonMessageSchema,
  type RequestEvent,
  type ResponseEvent,
  type SDKMessage,
} from "@claudin/events";
import { appendCredentials, type ConnectionCredentials } from "../auth/connectionCredentials.ts";

export type AgentResponseEvent = ResponseEvent<SDKMessage>;

export type DaemonEvent = AgentResponseEvent | RequestEvent;

export type DaemonEventListener = (event: DaemonEvent, peer: boolean) => void;

export interface EventClient {
  send(request: RequestEvent): void;
  subscribe(listener: DaemonEventListener): () => void;
  close(): void;
}

export class DaemonClient implements EventClient {
  readonly listeners = new Set<DaemonEventListener>();

  private constructor(private socket: WebSocket) {
    socket.addEventListener("message", (event) => this.notifyListeners(String(event.data)));
  }

  static async connect(url: string, credentials: ConnectionCredentials): Promise<DaemonClient> {
    const socket = new WebSocket(appendCredentials(url, credentials));
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

  subscribe(listener: DaemonEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onDisconnect(handler: () => void): void {
    this.socket.addEventListener("close", handler, { once: true });
  }

  close(): void {
    this.socket.close();
  }

  notifyListeners(data: string): void {
    const { event, peer } = daemonMessageSchema.parse(JSON.parse(data));
    for (const listener of this.listeners) listener(event as DaemonEvent, peer);
  }
}
