import type { RequestEvent } from "@claudin/events";
import { readCachedRateLimits, writeCachedRateLimits } from "../persistence/rateLimitCache.ts";
import type { RequestHandlers } from "../server/requestHandler.ts";

type AgentHandlers = Pick<RequestHandlers, Extract<RequestEvent["type"], `agent.${string}`>>;

export const agentHandlers: AgentHandlers = {
  async *"agent.session.info.requested"({ agents }, request) {
    const info = await agents.getAgentSessionInfo(request.agentSessionId, request.options);
    yield { type: "agent.session.info.received", info };
  },
  async *"agent.session.messages.requested"({ agents }, request) {
    const messages = await agents.getAgentSessionMessages(request.agentSessionId, request.options);
    yield { type: "agent.session.messages.received", messages };
  },
  async *"agent.session.create.requested"({ agents, cwd }, request) {
    const agentSessionId = agents.createSession({ cwd, ...request.options });
    yield { type: "agent.session.created", agentSessionId };
  },
  async *"agent.session.resume.requested"({ agents, cwd }, request) {
    const agentSessionId = await agents.resumeSession(request.agentSessionId, {
      cwd,
      ...request.options,
    });
    yield { type: "agent.session.created", agentSessionId };
  },
  async *"agent.session.fork.requested"({ agents, cwd }, request) {
    const agentSessionId = await agents.forkSession(request.agentSessionId, request.forkOptions, {
      cwd,
      ...request.options,
    });
    yield { type: "agent.session.created", agentSessionId };
  },
  async *"agent.prompt.requested"({ agents }, request) {
    yield* agents.requireSession(request.agentSessionId).prompt(request.content);
  },
  async *"agent.prompt.queue.requested"({ agents }, request) {
    const turn = agents.requireSession(request.agentSessionId).prompt(request.content, "later");
    yield { type: "agent.prompt.accepted", agentSessionId: request.agentSessionId };
    yield* turn;
  },
  async *"agent.prompt.steer.requested"({ agents }, request) {
    const turn = agents.requireSession(request.agentSessionId).prompt(request.content, "now");
    yield { type: "agent.prompt.accepted", agentSessionId: request.agentSessionId };
    yield* turn;
  },
  async *"agent.prompt.cancel.requested"({ agents }, request) {
    await agents.requireSession(request.agentSessionId).cancel();
    yield { type: "agent.prompt.cancelled", agentSessionId: request.agentSessionId };
  },
  async *"agent.tool.approval.answered"({ agents }, request) {
    agents
      .requireSession(request.agentSessionId)
      .answerApproval(request.toolUseId, request.decision);
  },
  async *"agent.question.answered"({ agents }, request) {
    agents
      .requireSession(request.agentSessionId)
      .answerQuestion(request.toolUseId, request.answers);
  },
  async *"agent.model.set.requested"({ agents }, request) {
    await agents.requireSession(request.agentSessionId).setModel(request.model);
    yield { type: "agent.model.changed", model: request.model };
  },
  async *"agent.model.cycle.requested"({ agents }, request) {
    const model = await agents.requireSession(request.agentSessionId).cycleModel();
    if (model) yield { type: "agent.model.changed", model };
  },
  async *"agent.effort.set.requested"({ agents }, request) {
    await agents.requireSession(request.agentSessionId).setEffort(request.effort);
    yield { type: "agent.effort.changed", effort: request.effort };
  },
  async *"agent.permission_mode.set.requested"({ agents }, request) {
    await agents.requireSession(request.agentSessionId).setPermissionMode(request.mode);
    yield { type: "agent.permission_mode.changed", mode: request.mode };
  },
  async *"agent.models.requested"({ agents }, request) {
    const models = await agents.requireSession(request.agentSessionId).fetchModels();
    yield { type: "agent.models.received", models };
  },
  async *"agent.commands.requested"({ agents }, request) {
    const commands = await agents.requireSession(request.agentSessionId).fetchCommands();
    yield { type: "agent.commands.received", commands };
  },
  async *"agent.mcp.status.requested"({ agents }, request) {
    const servers = await agents.requireSession(request.agentSessionId).fetchMcpStatus();
    yield { type: "agent.mcp.status.received", servers };
  },
  async *"agent.usage.requested"({ agents }, request) {
    const { session } = await agents.requireSession(request.agentSessionId).fetchUsage();
    yield { type: "agent.usage.received", usage: session };
  },
  async *"agent.rate_limit.cached.requested"() {
    const rateLimit = await readCachedRateLimits();
    if (rateLimit) yield { type: "agent.rate_limit.received", rateLimit };
  },
  async *"agent.files.rewind.requested"({ agents }, request) {
    const { userMessageId } = request;
    const result = await agents.requireSession(request.agentSessionId).rewindFiles(userMessageId);
    yield {
      type: "agent.files.rewound",
      userMessageId,
      filesChanged: result.filesChanged ?? [],
      insertions: result.insertions ?? 0,
      deletions: result.deletions ?? 0,
    };
  },
  async *"agent.rate_limit.requested"({ agents }, request) {
    const { rate_limits: rateLimit } = await agents
      .requireSession(request.agentSessionId)
      .fetchUsage();
    await writeCachedRateLimits(rateLimit);
    yield { type: "agent.rate_limit.received", rateLimit };
  },
};
