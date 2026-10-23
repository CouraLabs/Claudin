import { expect, test } from "vitest";
import { DEFAULT_EFFORT, effortLevelSchema } from "../requests/agentRequestEvents.ts";
import type { AppEvent } from "../session/appEvent.ts";
import { createSessionState } from "../session/sessionState.ts";
import { reduceSessionState } from "./reduceSessionState.ts";

const play = (events: AppEvent[]) => events.reduce(reduceSessionState, createSessionState("s"));

const LEVELS = effortLevelSchema.options;

test("opens the effort picker on the current effort", () => {
  const state = play([
    { type: "agent.effort.changed", effort: "max" },
    { type: "ui.effort.picker.opened" },
  ]);
  expect(state.ui.picker).toEqual({ kind: "effort", selected: LEVELS.indexOf("max") });
});

test("opens the effort picker on the default effort when none is set", () => {
  const state = play([{ type: "ui.effort.picker.opened" }]);
  expect(state.ui.picker).toEqual({ kind: "effort", selected: LEVELS.indexOf(DEFAULT_EFFORT) });
});

test("wraps the effort picker selection across every level", () => {
  const state = play([
    { type: "agent.effort.changed", effort: "low" },
    { type: "ui.effort.picker.opened" },
    { type: "ui.picker.moved", delta: -1 },
  ]);
  expect(state.ui.picker).toEqual({ kind: "effort", selected: LEVELS.length - 1 });
});
