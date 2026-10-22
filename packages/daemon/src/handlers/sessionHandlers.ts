import type { RequestHandlers } from "../server/requestHandler.ts";

export const sessionHandlers: Pick<
  RequestHandlers,
  "session.create.requested" | "session.restore.requested" | "session.list.requested"
> = {
  async *"session.create.requested"(context) {
    yield context.startFreshSession();
  },
  async *"session.restore.requested"(context, request) {
    yield await context.restoreStoredSession(request.sessionId);
  },
  async *"session.list.requested"(context) {
    yield { type: "session.list.received", sessions: await context.store.list() };
  },
};
