import type { SessionState } from "@kraude-kode/events";
import type { AppStore } from "../store/appStore.ts";
import { SLASH_ALIASES, SLASH_COMMANDS } from "./localCommands.ts";

const parseSlashLine = (line: string): [name: string, argument: string] => {
  const [name = "", ...rest] = line.trim().split(/\s+/);
  const lowered = name.toLowerCase();
  return [SLASH_ALIASES[lowered] ?? lowered, rest.join(" ")];
};

export function isAgentCommand(state: SessionState, line: string): boolean {
  const [name] = parseSlashLine(line);
  return !(name in SLASH_COMMANDS) && state.slashCommands.some((c) => `/${c.name}` === name);
}

export function runSlashCommand(store: AppStore, line: string): void {
  const [name, argument] = parseSlashLine(line);
  const command = SLASH_COMMANDS[name];
  if (command) return command.run(store, argument);
  store.emit({ type: "ui.notice.posted", text: `Unknown command: ${name}` });
}
