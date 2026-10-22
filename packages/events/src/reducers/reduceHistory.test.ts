import { expect, test } from "vitest";
import type { UiEvent } from "../requests/uiEvents.ts";
import { createSessionState, type SessionState } from "../session/sessionState.ts";
import { readHistoryText } from "./reduceHistory.ts";
import { reduceSessionState } from "./reduceSessionState.ts";

const withPrompts = (...prompts: string[]): SessionState => ({
  ...createSessionState("s"),
  promptHistory: prompts,
});

const apply = (state: SessionState, ...events: UiEvent[]) =>
  events.reduce(reduceSessionState, state);

test("moving through history walks prompts and returns to the draft", () => {
  const start = withPrompts("one", "two");
  const up = apply(start, { type: "ui.history.moved", delta: -1, draft: "draft" });
  expect(readHistoryText(up)).toBe("two");
  const top = apply(up, { type: "ui.history.moved", delta: -1, draft: "two" });
  const clamped = apply(top, { type: "ui.history.moved", delta: -1, draft: "one" });
  expect(readHistoryText(clamped)).toBe("one");
  const back = apply(clamped, ...Array(2).fill({ type: "ui.history.moved", delta: 1, draft: "" }));
  expect(readHistoryText(back)).toBe("draft");
});

test("searching history finds older matches and notices when none remain", () => {
  const start = withPrompts("fix login", "write docs", "fix logout");
  const first = apply(start, { type: "ui.history.searched", draft: "FIX" });
  expect(readHistoryText(first)).toBe("fix logout");
  const second = apply(first, { type: "ui.history.searched", draft: "fix logout" });
  expect(readHistoryText(second)).toBe("fix login");
  const none = apply(second, { type: "ui.history.searched", draft: "fix login" });
  expect(none.transcript.at(-1)).toMatchObject({ text: "No earlier prompt matches" });
});

test("loading keeps the newest ten and puts earlier entries before in-session prompts", () => {
  const loaded = apply(withPrompts("now"), {
    type: "ui.history.loaded",
    entries: Array.from({ length: 10 }, (_, at) => `old${at}`),
  });
  expect(loaded.promptHistory).toHaveLength(10);
  expect(loaded.promptHistory.at(-1)).toBe("now");
  expect(loaded.promptHistory[0]).toBe("old1");
});
