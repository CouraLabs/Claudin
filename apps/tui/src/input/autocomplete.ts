import type { AutocompleteKind } from "@kraude-kode/events";
import type { KeyEvent } from "@opentui/core";
import type { AppStore } from "../store/appStore.ts";
import { listSlashCommands } from "./slashCatalog.ts";

export type CompletionTrigger = { kind: AutocompleteKind; query: string; start: number };

const SLASH_PATTERN = /^\/(\S*)$/;
const FILE_PATTERN = /(?:^|\s)@(\S*)$/;

export function detectAutocomplete(text: string, cursor: number): CompletionTrigger | null {
  const beforeCursor = text.slice(0, cursor);
  const slash = SLASH_PATTERN.exec(beforeCursor);
  if (slash) return { kind: "slash", query: slash[1] ?? "", start: 0 };
  const file = FILE_PATTERN.exec(beforeCursor);
  if (!file) return null;
  const query = file[1] ?? "";
  return { kind: "file", query, start: cursor - query.length - 1 };
}

export type AppliedCompletion = { text: string; cursor: number };

export function applyCompletion(
  text: string,
  cursor: number,
  trigger: CompletionTrigger,
  choice: string,
): AppliedCompletion {
  const word = trigger.kind === "slash" ? choice : `@${choice}`;
  const head = text.slice(0, trigger.start);
  const tail = text.slice(cursor);
  const spaced = /^\s/.test(tail);
  const insertion = spaced ? word : `${word} `;
  return {
    text: head + insertion + tail,
    cursor: head.length + insertion.length + (spaced ? 1 : 0),
  };
}

type Editor = { text: string; cursor: number; replaceText(text: string, cursor: number): void };

export function syncAutocomplete(store: AppStore, text: string, cursor: number): void {
  const trigger = detectAutocomplete(text, cursor);
  const current = store.state.ui.autocomplete;
  if (!trigger) {
    if (current) store.emit({ type: "ui.autocomplete.changed", autocomplete: null });
    return;
  }
  if (current?.kind === trigger.kind && current.query === trigger.query) return;
  const matches =
    trigger.kind === "slash" ? listSlashCommands(trigger.query, store.state.slashCommands) : [];
  store.emit({
    type: "ui.autocomplete.changed",
    autocomplete: { kind: trigger.kind, query: trigger.query, matches, selected: 0 },
  });
  if (trigger.kind === "file") {
    store.request({ type: "workspace.files.requested", query: trigger.query });
  }
}

export function acceptAutocomplete(store: AppStore, editor: Editor): void {
  const { autocomplete } = store.state.ui;
  const trigger = detectAutocomplete(editor.text, editor.cursor);
  const choice = autocomplete?.matches[autocomplete.selected];
  if (!trigger || !choice) return;
  const applied = applyCompletion(editor.text, editor.cursor, trigger, choice);
  editor.replaceText(applied.text, applied.cursor);
}

export function routeAutocompleteKey(key: KeyEvent, store: AppStore, accept: () => void): boolean {
  const { autocomplete } = store.state.ui;
  if (!autocomplete || autocomplete.matches.length === 0) return false;
  if (key.name === "up" || key.name === "down") {
    store.emit({ type: "ui.autocomplete.moved", delta: key.name === "up" ? -1 : 1 });
    return true;
  }
  if (key.name === "tab" || key.name === "return") {
    accept();
    return true;
  }
  if (key.name !== "escape") return false;
  store.emit({ type: "ui.autocomplete.changed", autocomplete: null });
  return true;
}
