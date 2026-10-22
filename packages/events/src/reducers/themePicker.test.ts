import { expect, test } from "vitest";
import { THEME_NAMES } from "../models/themeNames.ts";
import { readPermissionLabel } from "../requests/agentRequestEvents.ts";
import type { AppEvent } from "../session/appEvent.ts";
import { createSessionState } from "../session/sessionState.ts";
import { reduceSessionState } from "./reduceSessionState.ts";

const play = (events: AppEvent[]) => events.reduce(reduceSessionState, createSessionState("s"));

test("opens the theme picker on the current theme", () => {
  const state = play([
    { type: "ui.theme.selected", theme: "dracula" },
    { type: "ui.theme.picker.opened" },
  ]);
  expect(state.ui.picker).toEqual({ kind: "theme", selected: THEME_NAMES.indexOf("dracula") });
});

test("wraps the theme picker selection across every theme", () => {
  const state = play([
    { type: "ui.theme.selected", theme: THEME_NAMES[0] },
    { type: "ui.theme.picker.opened" },
    { type: "ui.picker.moved", delta: -1 },
  ]);
  expect(state.ui.picker).toEqual({ kind: "theme", selected: THEME_NAMES.length - 1 });
});

test("selecting a theme stores it and posts a notice", () => {
  const state = play([{ type: "ui.theme.selected", theme: "nord" }]);
  expect(state.theme).toBe("nord");
  expect(state.transcript.at(-1)).toMatchObject({ kind: "notice", text: "Theme set to nord" });
});

test("reads readable permission labels and passes unknown modes through", () => {
  expect(readPermissionLabel("acceptEdits")).toBe("Accept Edits Permission");
  expect(readPermissionLabel("auto")).toBe("Automatic Permissions");
  expect(readPermissionLabel("custom")).toBe("custom");
});
