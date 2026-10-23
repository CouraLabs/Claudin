import { expect, test } from "vitest";
import type { AppEvent } from "../session/appEvent.ts";
import { createSessionState } from "../session/sessionState.ts";
import { reduceSessionState, reduceTimedEvent } from "./reduceSessionState.ts";
import { findAwaitingCalls, listToolCalls } from "./toolGroups.ts";

const play = (events: unknown[]) =>
  (events as AppEvent[]).reduce(reduceSessionState, createSessionState("s"));

const sdk = (message: unknown) => ({ type: "agent.message.received", message });
const stream = (event: unknown) => sdk({ type: "stream_event", parent_tool_use_id: null, event });
const assistant = (id: string, content: unknown[], usage = {}) =>
  sdk({ type: "assistant", parent_tool_use_id: null, message: { id, content, usage } });
const toolUse = (id: string, name: string, input: unknown = {}) => ({
  type: "tool_use",
  id,
  name,
  input,
});
const toolResult = (id: string, content: string, isError = false) =>
  sdk({
    type: "user",
    message: { content: [{ type: "tool_result", tool_use_id: id, content, is_error: isError }] },
  });
const prompt = { type: "agent.prompt.requested", agentSessionId: "a", content: "hi" };

test("prompt adds a user entry and starts thinking", () => {
  const state = play([prompt]);
  expect(state.status).toBe("thinking");
  expect(state.transcript).toMatchObject([{ kind: "user", text: "hi" }]);
});

test("streamed text deltas merge into the final assistant message", () => {
  const state = play([
    prompt,
    stream({ type: "message_start", message: { id: "m1", usage: { input_tokens: 10 } } }),
    stream({ type: "content_block_start", index: 0, content_block: { type: "text" } }),
    stream({ type: "content_block_delta", delta: { type: "text_delta", text: "Hel" } }),
    stream({ type: "content_block_delta", delta: { type: "text_delta", text: "lo" } }),
  ]);
  expect(state.transcript.at(-1)).toMatchObject({ text: "Hello", streaming: true });

  const done = reduceSessionState(
    state,
    assistant("m1", [{ type: "text", text: "Hello" }], {
      input_tokens: 10,
      output_tokens: 2,
    }) as AppEvent,
  );
  const replies = done.transcript.filter((entry) => entry.kind === "assistant");
  expect(replies).toHaveLength(1);
  expect(replies[0]).toMatchObject({ text: "Hello", streaming: false });
  expect(done.tokens).toMatchObject({ input: 10, output: 2 });
});

test("consecutive tool calls share a group and text starts a new one", () => {
  const state = play([
    prompt,
    assistant("m1", [toolUse("t1", "Read")]),
    toolResult("t1", "ok"),
    assistant("m2", [toolUse("t2", "Bash", { command: "ls" })]),
    assistant("m2", [{ type: "text", text: "done" }]),
    assistant("m3", [toolUse("t3", "Read")]),
  ]);
  const groups = state.transcript.filter((entry) => entry.kind === "tools");
  expect(groups.map((group) => group.calls.map((call) => call.id))).toEqual([["t1", "t2"], ["t3"]]);
  expect(listToolCalls(state).map((call) => call.status)).toEqual([
    "completed",
    "running",
    "running",
  ]);
  expect(state.status).toBe("executing");
});

test("approval gates a tool call and resolution resumes it", () => {
  const required = {
    type: "agent.tool.approval.required",
    agentSessionId: "a",
    toolUseId: "t1",
    toolName: "Bash",
    input: { command: "npm test" },
  };
  const waiting = play([prompt, assistant("m1", [toolUse("t1", "Bash")]), required]);
  expect(waiting.status).toBe("approval_required");
  expect(findAwaitingCalls(waiting)).toHaveLength(1);

  const approved = reduceSessionState(waiting, {
    type: "agent.tool.approval.resolved",
    toolUseId: "t1",
    decision: "approve",
  });
  expect(approved.status).toBe("executing");

  const rejected = reduceSessionState(waiting, {
    type: "agent.tool.approval.resolved",
    toolUseId: "t1",
    decision: "reject",
  });
  expect(listToolCalls(rejected)[0]).toMatchObject({ status: "failed", error: "Rejected by user" });
});

test("approval arriving before its tool_use still creates the call", () => {
  const state = play([
    prompt,
    {
      type: "agent.tool.approval.required",
      agentSessionId: "a",
      toolUseId: "t9",
      toolName: "Edit",
      input: { file_path: "a.ts" },
    },
    assistant("m1", [toolUse("t9", "Edit", { file_path: "a.ts" })]),
  ]);
  expect(listToolCalls(state)).toHaveLength(1);
  expect(listToolCalls(state)[0]?.status).toBe("awaiting_approval");
});

test("result returns to idle and records the context window", () => {
  const state = play([
    prompt,
    sdk({
      type: "result",
      subtype: "success",
      is_error: false,
      modelUsage: { m: { contextWindow: 1_000_000 } },
    }),
  ]);
  expect(state.status).toBe("idle");
  expect(state.tokens.maxContext).toBe(1_000_000);
});

test("failed results surface an error notice", () => {
  const state = play([
    prompt,
    sdk({ type: "result", subtype: "error_max_turns", is_error: true, errors: ["too long"] }),
  ]);
  expect(state.status).toBe("error");
  expect(state.transcript.at(-1)).toMatchObject({
    kind: "notice",
    text: "Error: error_max_turns too long",
  });
});

test("cancelling fails open tool calls and goes idle", () => {
  const state = play([
    prompt,
    assistant("m1", [toolUse("t1", "Bash")]),
    { type: "agent.prompt.cancelled", agentSessionId: "a" },
  ]);
  expect(state.status).toBe("idle");
  expect(listToolCalls(state)[0]).toMatchObject({ status: "failed", error: "Cancelled" });
});

test("system init fills model and workspace info", () => {
  const state = play([
    sdk({ type: "system", subtype: "init", model: "claude-x", cwd: "/w", permissionMode: "plan" }),
    { type: "workspace.info.received", cwd: "/home", gitBranch: "main" },
  ]);
  expect(state).toMatchObject({
    model: "claude-x",
    permissionMode: "plan",
    cwd: "/home",
    gitBranch: "main",
  });
});

test("ui events cycle focus, move completions and toggle tool calls", () => {
  const withTool = play([prompt, assistant("m1", [toolUse("t1", "Read")])]);
  expect(listToolCalls(withTool)[0]?.expanded).toBe(false);

  const cycled = reduceSessionState(withTool, { type: "ui.focus.cycled", direction: 1 });
  expect(cycled.ui.focus).toBe("scrollback");
  expect(reduceSessionState(cycled, { type: "ui.focus.cycled", direction: 1 }).ui.focus).toBe(
    "input",
  );

  const toggled = reduceSessionState(withTool, { type: "ui.tool.toggled", callId: "t1" });
  expect(listToolCalls(toggled)[0]?.expanded).toBe(true);
  const collapsed = reduceSessionState(toggled, { type: "ui.tool.toggled", callId: "t1" });
  expect(listToolCalls(collapsed)[0]?.expanded).toBe(false);

  const completing = reduceSessionState(withTool, {
    type: "ui.autocomplete.changed",
    autocomplete: { kind: "slash", query: "", matches: ["/a", "/b"], selected: 0 },
  });
  const moved = reduceSessionState(completing, { type: "ui.autocomplete.moved", delta: -1 });
  expect(moved.ui.autocomplete?.selected).toBe(1);
});

test("tool calls are timed from start until they settle", () => {
  const running = play([prompt, assistant("m1", [toolUse("t1", "Bash")])]);
  const [started] = listToolCalls(running);
  expect(started?.startedAt).toBeGreaterThan(0);
  expect(started?.endedAt).toBeUndefined();
  const done = reduceSessionState(running, toolResult("t1", "ok") as AppEvent);
  expect(listToolCalls(done)[0]?.endedAt).toBeGreaterThanOrEqual(started?.startedAt ?? 0);
});

test("queued and steered prompts keep the turn going through the next result", () => {
  const result = sdk({ type: "result", subtype: "success", is_error: false });
  const queued = play([
    prompt,
    { type: "agent.prompt.queue.requested", agentSessionId: "a", content: "next" },
  ]);
  expect(queued.queuedTurns).toBe(1);
  const afterFirst = reduceSessionState(queued, result as AppEvent);
  expect(afterFirst).toMatchObject({ status: "thinking", queuedTurns: 0 });
  expect(reduceSessionState(afterFirst, result as AppEvent).status).toBe("idle");

  const steered = play([
    prompt,
    { type: "agent.prompt.steer.requested", agentSessionId: "a", content: "now" },
  ]);
  expect(steered.queuedTurns).toBe(1);
});

test("queueing while idle behaves like a normal prompt", () => {
  const state = play([{ type: "agent.prompt.queue.requested", agentSessionId: "a", content: "x" }]);
  expect(state.queuedTurns).toBe(0);
});

test("model notices use the readable model name", () => {
  const state = play([{ type: "agent.model.changed", model: "claude-haiku-5-5" }]);
  expect(state.model).toBe("claude-haiku-5-5");
  expect(state.transcript.at(-1)).toMatchObject({ text: "Model set to Claude Haiku 5.5" });
});

test("rate limits and slash commands are stored", () => {
  const resetsAt = "2030-01-01T00:00:00.000Z";
  const state = play([
    {
      type: "agent.rate_limit.received",
      rateLimit: {
        five_hour: { utilization: 23.4, resets_at: resetsAt },
        seven_day: { utilization: null, resets_at: null },
      },
    },
    {
      type: "agent.commands.received",
      commands: [{ name: "compact", description: "Compact", argumentHint: "" }],
    },
  ]);
  expect(state.rateLimits).toEqual({
    fiveHour: { utilization: 23.4, resetsAt: Date.parse(resetsAt) },
    sevenDay: undefined,
  });
  expect(state.slashCommands).toHaveLength(1);
  const unavailable = { type: "agent.rate_limit.received", rateLimit: null };
  expect(play([unavailable]).rateLimits).toEqual({});
  const known = {
    type: "agent.rate_limit.received",
    rateLimit: { five_hour: { utilization: 23.4, resets_at: resetsAt } },
  };
  expect(play([known, unavailable]).rateLimits.fiveHour?.utilization).toBe(23.4);
});

test("rate limit events from the stream update both windows", () => {
  const state = play([
    {
      type: "agent.message.received",
      message: {
        type: "rate_limit_event",
        rate_limit_info: {
          unifiedWindows: {
            five_hour: { utilization: 0.42, resetsAt: 1_900_000_000 },
            seven_day: { utilization: 0.5, resetsAt: 1_900_100_000 },
          },
        },
      },
    },
  ]);
  expect(state.rateLimits).toEqual({
    fiveHour: { utilization: 42, resetsAt: 1_900_000_000_000 },
    sevenDay: { utilization: 50, resetsAt: 1_900_100_000_000 },
  });
});

test("restoring replays events, settles open work and keeps the agent session", () => {
  const events = [
    { type: "session.created", sessionId: "s1" },
    { type: "agent.session.created", agentSessionId: "a1" },
    { type: "agent.model.changed", model: "claude-haiku-5-5" },
    prompt,
    assistant("m1", [toolUse("t1", "Bash")]),
  ];
  const stored = events.map((event, index) => ({
    timestamp: 1_000 + index * 1_000,
    event: event as AppEvent,
  }));
  const state = reduceSessionState(createSessionState("fresh"), {
    type: "session.restored",
    sessionId: "s1",
    events: stored,
  });
  expect(state).toMatchObject({
    sessionId: "s1",
    agentSessionId: "a1",
    model: "claude-haiku-5-5",
    status: "idle",
  });
  expect(listToolCalls(state)[0]).toMatchObject({ status: "failed", error: "Interrupted" });
  expect(state.transcript.at(-1)).toMatchObject({ text: "Session restored" });
});

test("file matches only apply to the matching query", () => {
  const typing = play([
    {
      type: "ui.autocomplete.changed",
      autocomplete: { kind: "file", query: "ap", matches: [], selected: 0 },
    },
    { type: "workspace.files.received", query: "old", matches: ["x"] },
    { type: "workspace.files.received", query: "ap", matches: ["src/app.ts"] },
  ]);
  expect(typing.ui.autocomplete?.matches).toEqual(["src/app.ts"]);
});

test("session.created resets the transcript but keeps workspace info", () => {
  const state = play([
    { type: "workspace.info.received", cwd: "/w", gitBranch: "main" },
    prompt,
    { type: "session.created", sessionId: "s2" },
  ]);
  expect(state).toMatchObject({ sessionId: "s2", cwd: "/w", gitBranch: "main", transcript: [] });
});

test("a fresh session waits for its own agent session", () => {
  const state = play([
    { type: "agent.session.created", agentSessionId: "a1" },
    { type: "session.created", sessionId: "s2" },
  ]);
  expect(state.agentSessionId).toBeUndefined();
  const started = reduceSessionState(state, {
    type: "agent.session.created",
    agentSessionId: "a2",
  });
  expect(started.agentSessionId).toBe("a2");
});

test("thinking blocks become thought entries with a duration", () => {
  const started = reduceTimedEvent(
    createSessionState("s"),
    stream({
      type: "content_block_start",
      index: 0,
      content_block: { type: "thinking" },
    }) as AppEvent,
    1_000,
  );
  expect(started.thinkingStartedAt).toBe(1_000);
  const done = reduceTimedEvent(started, stream({ type: "content_block_stop" }) as AppEvent, 3_500);
  expect(done.thinkingStartedAt).toBeUndefined();
  expect(done.transcript.at(-1)).toMatchObject({ kind: "thought", durationMs: 2_500 });
});

test("a turn is timed from prompt until the result", () => {
  const running = play([prompt]);
  expect(running.turnStartedAt).toBeDefined();
  expect(running.transcript[0]).toHaveProperty("at");
  const finished = reduceSessionState(running, {
    type: "agent.message.received",
    message: { type: "result", subtype: "success", is_error: false },
  } as AppEvent);
  expect(finished.turnStartedAt).toBeUndefined();
});

test("effort comes from session creation, init and changes", () => {
  const created = play([
    { type: "agent.session.create.requested", options: { effort: "high", model: "m1" } },
  ]);
  expect(created.effort).toBe("high");
  expect(created.model).toBe("m1");
  const changed = reduceSessionState(created, { type: "agent.effort.changed", effort: "max" });
  expect(changed.effort).toBe("max");
  const withInit = reduceSessionState(
    changed,
    sdk({
      type: "system",
      subtype: "init",
      model: "m",
      cwd: "/",
      permissionMode: "default",
    }) as AppEvent,
  );
  expect(withInit.effort).toBe("max");
  const reported = reduceSessionState(
    changed,
    sdk({
      type: "system",
      subtype: "init",
      model: "m",
      cwd: "/",
      permissionMode: "default",
      effort: "low",
    }) as AppEvent,
  );
  expect(reported.effort).toBe("low");
});

test("a new session defaults to bypass permission mode", () => {
  expect(play([]).permissionMode).toBe("bypassPermissions");
});

test("receiving models opens the model picker on the current model", () => {
  const models = [
    { value: "default", displayName: "Default", description: "" },
    { value: "haiku", resolvedModel: "claude-haiku-5-5", displayName: "Haiku", description: "" },
  ];
  const opened = play([
    { type: "agent.model.changed", model: "haiku" },
    { type: "agent.models.received", models },
  ]);
  expect(opened.models.map((model) => model.value)).toEqual(["haiku"]);
  expect(opened.ui.picker).toEqual({ kind: "model", selected: 0 });
  const moved = reduceSessionState(opened, { type: "ui.picker.moved", delta: 1 });
  expect(moved.ui.picker?.selected).toBe(0);
  expect(reduceSessionState(moved, { type: "ui.picker.closed" }).ui.picker).toBeNull();
  const named = reduceSessionState(opened, { type: "agent.model.changed", model: "haiku" });
  expect(named.transcript.at(-1)).toMatchObject({ text: "Model set to Claude Haiku 5.5" });
});

test("receiving sessions opens the session picker or reports none", () => {
  const sessions = [{ id: "s1", title: "t", cwd: "/w", updatedAt: 1 }];
  expect(play([{ type: "session.list.received", sessions }]).ui.picker).toEqual({
    kind: "session",
    selected: 0,
  });
  const none = play([{ type: "session.list.received", sessions: [] }]);
  expect(none.ui.picker).toBeNull();
  expect(none.transcript.at(-1)).toMatchObject({ text: "No stored sessions yet" });
});

test("changing directory updates the workspace and keeps the new agent session", () => {
  const state = play([
    { type: "session.created", sessionId: "s2" },
    { type: "agent.session.created", agentSessionId: "a2" },
    { type: "workspace.cwd.changed", cwd: "/new", gitBranch: "dev" },
  ]);
  expect(state).toMatchObject({ cwd: "/new", gitBranch: "dev", agentSessionId: "a2" });
});

test("compaction and local command output become notices", () => {
  const state = play([
    sdk({ type: "system", subtype: "status", status: "compacting" }),
    sdk({
      type: "system",
      subtype: "compact_boundary",
      compact_metadata: { trigger: "manual", pre_tokens: 1000, post_tokens: 200 },
    }),
    sdk({ type: "system", subtype: "local_command_output", content: "Done" }),
    sdk({ type: "system", subtype: "status", status: null }),
  ]);
  expect(state.transcript.map((entry) => (entry.kind === "notice" ? entry.text : ""))).toEqual([
    "Compacting conversation...",
    "Conversation compacted (manual): 1,000 tokens → 200 tokens",
    "Done",
  ]);
});

test("restoring keeps the original event times and tool durations", () => {
  const stored = [
    { timestamp: 1_000, event: prompt },
    { timestamp: 2_000, event: assistant("m1", [toolUse("t1", "Bash")]) },
    { timestamp: 5_000, event: toolResult("t1", "ok") },
  ].map(({ timestamp, event }) => ({ timestamp, event: event as AppEvent }));
  const live = createSessionState("live");
  const restored = reduceTimedEvent(
    live,
    { type: "session.restored", sessionId: "s1", events: stored },
    90_000,
  );
  const [user] = restored.transcript;
  expect(user).toMatchObject({ kind: "user", at: 1_000 });
  expect(listToolCalls(restored)[0]).toMatchObject({ startedAt: 2_000, endedAt: 5_000 });
  expect(restored.transcript.at(-1)).toMatchObject({ text: "Session restored", at: 90_000 });
  expect(restored.now).toBe(90_000);
});

test("task progress puts the subagent summary on its running tool call", () => {
  const state = play([
    prompt,
    assistant("m1", [toolUse("t1", "Agent", { description: "Audit auth" })]),
    sdk({
      type: "system",
      subtype: "task_progress",
      tool_use_id: "t1",
      summary: "Analyzing authentication module",
    }),
    sdk({ type: "system", subtype: "task_progress", tool_use_id: "t1" }),
  ]);
  expect(listToolCalls(state)[0]?.progress).toBe("Analyzing authentication module");
});

test("mcp status points servers needing auth at the login command", () => {
  const servers = [
    { name: "docs", status: "needs-auth" },
    { name: "git", status: "connected" },
  ];
  const state = play([{ type: "agent.mcp.status.received", servers }]);
  expect(state.transcript).toMatchObject([
    {
      kind: "notice",
      text: expect.stringContaining("docs (needs-auth: sign in with /mcp login docs)"),
    },
  ]);
});

test("mcp login announces the sign-in link", () => {
  const state = play([
    { type: "agent.mcp.login.started", serverName: "docs", authUrl: "https://auth.example/docs" },
  ]);
  expect(state.transcript).toMatchObject([
    { kind: "notice", text: expect.stringContaining("https://auth.example/docs") },
  ]);
});
