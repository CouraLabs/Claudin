import type { EventClient } from "@claudin/daemon/client";
import type { RequestEvent } from "@claudin/events";
import { expect, test } from "vitest";
import { AppStore } from "../store/appStore.ts";
import { applyCompletion, detectAutocomplete } from "./autocomplete.ts";
import { answerApproval, cancelTurn, submitPrompt } from "./promptActions.ts";
import { listSlashCommands } from "./slashCatalog.ts";

function createStore() {
  const sent: RequestEvent[] = [];
  const client: EventClient = {
    send: (request) => sent.push(request),
    subscribe: () => () => {},
    close: () => {},
  };
  const store = new AppStore(client);
  store.request({ type: "workspace.info.requested" });
  sent.length = 0;
  return { store, sent };
}

test("detects slash and file triggers", () => {
  expect(detectAutocomplete("/pl", 3)).toEqual({ kind: "slash", query: "pl", start: 0 });
  expect(detectAutocomplete("/plan now", 9)).toBeNull();
  expect(detectAutocomplete("look at @src/ap", 15)).toEqual({
    kind: "file",
    query: "src/ap",
    start: 8,
  });
  expect(detectAutocomplete("mail a@b", 8)).toBeNull();
  expect(detectAutocomplete("plain", 5)).toBeNull();
});

test("applies slash and file completions", () => {
  const slash = detectAutocomplete("/pl", 3);
  expect(slash && applyCompletion("/pl", 3, slash, "/plan")).toEqual({ text: "/plan ", cursor: 6 });
  const file = detectAutocomplete("see @ap please", 7);
  expect(file && applyCompletion("see @ap please", 7, file, "src/app.ts")).toEqual({
    text: "see @src/app.ts please",
    cursor: 16,
  });
});

test("filters slash commands by prefix", () => {
  expect(listSlashCommands("", [])).toEqual([
    "/ask",
    "/plan",
    "/build",
    "/mode",
    "/permission",
    "/model",
    "/theme",
    "/theme-background",
    "/session",
    "/cd",
    "/effort",
    "/mcp",
    "/clear",
    "/quit",
  ]);
  expect(listSlashCommands("m", [])).toEqual(["/mode", "/model", "/mcp"]);
  expect(listSlashCommands("zzz", [])).toEqual([]);
});

test("slash commands include the agent sdk commands without duplicating local ones", () => {
  const sdk = [
    { name: "compact", description: "Compact the conversation", argumentHint: "" },
    { name: "model", description: "Pick a model", argumentHint: "" },
  ];
  const matches = listSlashCommands("", sdk);
  expect(matches).toContain("/compact");
  expect(matches.filter((name) => name === "/model")).toHaveLength(1);
  expect(listSlashCommands("comp", sdk)).toEqual(["/compact"]);
});

test("prompts need an agent session and an idle agent", () => {
  const { store, sent } = createStore();
  expect(submitPrompt(store, "   ")).toBe(false);
  expect(submitPrompt(store, "hello")).toBe(false);
  expect(store.state.transcript.at(-1)).toMatchObject({
    kind: "notice",
    text: "Agent session is not ready",
  });
  expect(sent).toEqual([]);
});

test("submits prompts, slash commands and approvals", () => {
  const sent: RequestEvent[] = [];
  let respond: (event: unknown) => void = () => {};
  const client: EventClient = {
    send: (request) => sent.push(request),
    subscribe: (listener) => {
      respond = listener as (event: unknown) => void;
      return () => {};
    },
    close: () => {},
  };
  const store = new AppStore(client);
  respond({ type: "agent.session.created", agentSessionId: "a1" });

  expect(submitPrompt(store, " hello ")).toBe(true);
  expect(sent.at(-1)).toEqual({
    type: "agent.prompt.requested",
    agentSessionId: "a1",
    content: "hello",
  });
  expect(submitPrompt(store, "again")).toBe(false);
  expect(store.state.transcript.at(-1)).toMatchObject({
    kind: "notice",
    text: expect.stringContaining("Ctrl+Q"),
  });
  expect(submitPrompt(store, "later", "queue")).toBe(true);
  expect(sent.at(-1)).toEqual({
    type: "agent.prompt.queue.requested",
    agentSessionId: "a1",
    content: "later",
  });
  expect(submitPrompt(store, "instead", "steer")).toBe(true);
  expect(sent.at(-1)).toEqual({
    type: "agent.prompt.steer.requested",
    agentSessionId: "a1",
    content: "instead",
  });
  submitPrompt(store, "/plan");
  expect(store.state.transcript.at(-1)).toMatchObject({
    text: expect.stringContaining("busy"),
  });

  respond({
    type: "agent.tool.approval.required",
    agentSessionId: "a1",
    toolUseId: "t1",
    toolName: "Bash",
    input: { command: "ls" },
  });
  answerApproval(store, "approve_all");
  expect(sent.at(-1)).toEqual({
    type: "agent.tool.approval.answered",
    agentSessionId: "a1",
    toolUseId: "t1",
    decision: "approve_all",
  });

  cancelTurn(store);
  expect(sent.at(-1)).toEqual({ type: "agent.prompt.cancel.requested", agentSessionId: "a1" });

  respond({ type: "agent.prompt.cancelled", agentSessionId: "a1" });
  submitPrompt(store, "/plan");
  expect(sent.at(-1)).toEqual({
    type: "agent.mode.set.requested",
    agentSessionId: "a1",
    mode: "plan",
  });
  submitPrompt(store, "/mode ask");
  expect(sent.at(-1)).toMatchObject({ type: "agent.mode.set.requested", mode: "ask" });
  respond({ type: "agent.mode.changed", mode: "ask" });
  submitPrompt(store, "/ask");
  expect(store.state.transcript.at(-1)).toMatchObject({ text: "Already in Ask mode" });
  submitPrompt(store, "/build");
  expect(sent.at(-1)).toMatchObject({ mode: "build" });
  submitPrompt(store, "/permission plan");
  expect(sent.at(-1)).toEqual({
    type: "agent.permission_mode.set.requested",
    agentSessionId: "a1",
    mode: "plan",
  });
  submitPrompt(store, "/model sonnet");
  expect(sent.at(-1)).toMatchObject({ type: "agent.model.set.requested", model: "sonnet" });
  submitPrompt(store, "/effort max");
  expect(sent.at(-1)).toEqual({
    type: "agent.effort.set.requested",
    agentSessionId: "a1",
    effort: "max",
  });
  submitPrompt(store, "/effort bogus");
  expect(store.state.transcript.at(-1)).toMatchObject({
    text: "Effort: default (usage: /effort low|medium|high|xhigh|max)",
  });
  submitPrompt(store, "/mcp");
  expect(sent.at(-1)).toMatchObject({ type: "agent.mcp.status.requested" });
  submitPrompt(store, "/clear");
  expect(sent.at(-1)).toMatchObject({ type: "session.create.requested" });
  submitPrompt(store, "/nope");
  expect(store.state.transcript.at(-1)).toMatchObject({ text: "Unknown command: /nope" });
});

test("every agent action reports a missing agent session the same way", () => {
  const { store, sent } = createStore();
  for (const action of [
    () => submitPrompt(store, "hello"),
    () => submitPrompt(store, "/mcp"),
    () => submitPrompt(store, "/model sonnet"),
    () => cancelTurn(store),
  ]) {
    const before = store.state.transcript.length;
    action();
    expect(store.state.transcript.length).toBe(before + 1);
    expect(store.state.transcript.at(-1)).toMatchObject({ text: "Agent session is not ready" });
  }
  expect(sent).toEqual([]);
});

test("agent sdk commands are sent to the agent as prompts", () => {
  const sent: RequestEvent[] = [];
  let respond: (event: unknown) => void = () => {};
  const client: EventClient = {
    send: (request) => sent.push(request),
    subscribe: (listener) => {
      respond = listener as (event: unknown) => void;
      return () => {};
    },
    close: () => {},
  };
  const store = new AppStore(client);
  respond({ type: "agent.session.created", agentSessionId: "a1" });
  respond({
    type: "agent.commands.received",
    commands: [{ name: "compact", description: "Compact", argumentHint: "" }],
  });
  expect(submitPrompt(store, "/compact now")).toBe(true);
  expect(sent.at(-1)).toEqual({
    type: "agent.prompt.requested",
    agentSessionId: "a1",
    content: "/compact now",
  });
});
