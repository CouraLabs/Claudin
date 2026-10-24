import { type AppEvent, type DaemonMessage, isSharedEvent } from "@kraude-kode/events";
import type { WebSocket } from "ws";

export function publishEvent(
  clients: Iterable<WebSocket>,
  origin: WebSocket,
  event: AppEvent,
  toOrigin = true,
): void {
  for (const socket of clients) {
    const peer = socket !== origin;
    const wanted = peer ? isSharedEvent(event) : toOrigin;
    if (!wanted || socket.readyState !== socket.OPEN) continue;
    const message: DaemonMessage = { event, peer };
    socket.send(JSON.stringify(message));
  }
}
