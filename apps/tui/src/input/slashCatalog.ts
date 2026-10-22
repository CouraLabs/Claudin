import type { SlashCommand as SdkCommand } from "@claudin/events";
import { SLASH_COMMANDS } from "./localCommands.ts";

export type SlashEntry = { name: string; description: string };

const describeSdkCommand = ({ description, argumentHint }: SdkCommand): string =>
  [argumentHint, description].filter(Boolean).join(" ");

export function buildSlashCatalog(sdkCommands: SdkCommand[]): SlashEntry[] {
  const local = Object.entries(SLASH_COMMANDS).map(([name, { description }]) => ({
    name,
    description,
  }));
  const remote = sdkCommands
    .map((command) => ({ name: `/${command.name}`, description: describeSdkCommand(command) }))
    .filter(({ name }) => !(name in SLASH_COMMANDS));
  return [...local, ...remote];
}

export const listSlashCommands = (query: string, sdkCommands: SdkCommand[]): string[] =>
  buildSlashCatalog(sdkCommands)
    .map(({ name }) => name)
    .filter((name) => name.slice(1).toLowerCase().startsWith(query.toLowerCase()));
