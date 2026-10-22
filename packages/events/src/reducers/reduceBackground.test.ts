import { expect, test } from "vitest";
import type { AppEvent } from "../session/appEvent.ts";
import { TRANSPARENT_BACKGROUND } from "../models/backgroundColor.ts";
import { reduceSessionState } from "./reduceSessionState.ts";
import { createSessionState } from "../session/sessionState.ts";

const play = (events: AppEvent[]) => events.reduce(reduceSessionState, createSessionState("s"));

const adjust = (delta: number): AppEvent => ({ type: "ui.background.value.adjusted", delta });

test("the background starts transparent with no editor", () => {
  const state = createSessionState("s");
  expect(state.background).toEqual(TRANSPARENT_BACKGROUND);
  expect(state.ui.backgroundEditor).toBeNull();
});

test("the editor adjusts one channel at a time and clamps to the byte range", () => {
  const state = play([
    { type: "ui.background.editor.opened" },
    adjust(40),
    { type: "ui.background.channel.moved", delta: 1 },
    adjust(-5),
    { type: "ui.background.channel.moved", delta: -1 },
    { type: "ui.background.channel.moved", delta: -1 },
    adjust(100),
    adjust(100),
  ]);
  expect(state.ui.backgroundEditor).toEqual({
    color: { r: 40, g: 0, b: 0, a: 200 },
    channel: 3,
  });
  expect(state.background).toEqual(TRANSPARENT_BACKGROUND);
});

test("closing the editor discards the draft", () => {
  const state = play([
    { type: "ui.background.editor.opened" },
    adjust(10),
    { type: "ui.background.editor.closed" },
  ]);
  expect(state.ui.backgroundEditor).toBeNull();
  expect(state.background).toEqual(TRANSPARENT_BACKGROUND);
});

test("a saved background closes the editor and survives a fresh session", () => {
  const color = { r: 1, g: 2, b: 3, a: 128 };
  const saved = play([
    { type: "ui.background.editor.opened" },
    { type: "options.background.saved", color },
  ]);
  expect(saved.background).toEqual(color);
  expect(saved.ui.backgroundEditor).toBeNull();
  expect(saved.transcript.at(-1)).toMatchObject({ text: "Background color saved" });
  const fresh = reduceSessionState(saved, { type: "session.created", sessionId: "next" });
  expect(fresh.background).toEqual(color);
});

test("loaded options set the background and default to transparent", () => {
  const color = { r: 9, g: 9, b: 9, a: 255 };
  const loaded = play([{ type: "options.loaded", background: color }]);
  expect(loaded.background).toEqual(color);
  expect(reduceSessionState(loaded, { type: "options.loaded" }).background).toEqual(
    TRANSPARENT_BACKGROUND,
  );
});
