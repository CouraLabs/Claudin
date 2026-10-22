import { renderTranscriptMarkdown } from "@claudin/events";
import type { RequestHandlers } from "../server/requestHandler.ts";
import { resolveUserPath } from "../workspace/resolvePath.ts";

type SessionRequestType = Extract<keyof RequestHandlers, `session.${string}`>;

const exportFileName = (sessionId: string): string => `claudin-${sessionId.slice(0, 8)}.md`;

export const sessionHandlers: Pick<RequestHandlers, SessionRequestType> = {
  async *"session.create.requested"(context) {
    yield context.startFreshSession();
  },
  async *"session.restore.requested"(context, request) {
    yield await context.restoreStoredSession(request.sessionId);
  },
  async *"session.list.requested"(context) {
    yield { type: "session.list.received", sessions: await context.store.list() };
  },
  async *"session.fork.requested"(context) {
    yield await context.forkCurrentSession();
  },
  async *"session.sync.requested"({ agents, session, store }) {
    const events = await store.read(session.id);
    const agentLive = agents.hasSession(session.state.agentSessionId ?? "");
    yield { type: "session.synced", sessionId: session.id, events, agentLive };
  },
  async *"session.export.requested"({ cwd, session }, request) {
    const path = resolveUserPath(cwd, request.path || exportFileName(session.id));
    await Bun.write(path, renderTranscriptMarkdown(session.state));
    yield { type: "session.exported", path };
  },
  async *"session.search.requested"({ store }, request) {
    const sessions = await store.search(request.query);
    yield { type: "session.search.received", query: request.query, sessions };
  },
};
