import { effortLevelSchema, permissionModeSchema, themeNameSchema } from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";
import { isAgentBusy } from "./agentBusy.ts";
import { requestAgent } from "./agentRequest.ts";

export type SlashCommand = {
  description: string;
  run: (store: AppStore, argument: string) => void;
};

export function guardIdle(store: AppStore, action: string): boolean {
  if (!isAgentBusy(store)) return true;
  const text = `Agent is busy: cancel the current turn before ${action}`;
  store.emit({ type: "ui.notice.posted", text });
  return false;
}

export function cycleModel(store: AppStore): void {
  requestAgent(store, { type: "agent.model.cycle.requested" });
}

const QUIT_COMMAND: SlashCommand = {
  description: "Exit the app (also /exit, /q, /leave)",
  run: (store) => store.emit({ type: "ui.exit.requested" }),
};

export const SLASH_ALIASES: Record<string, string> = {
  "/exit": "/quit",
  "/q": "/quit",
  "/leave": "/quit",
};

export const SLASH_COMMANDS: Record<string, SlashCommand> = {
  "/permission": {
    description: "Show or set the permission mode",
    run(store, argument) {
      const parsed = permissionModeSchema.safeParse(argument);
      if (parsed.success) {
        return void requestAgent(store, {
          type: "agent.permission_mode.set.requested",
          mode: parsed.data,
        });
      }
      const text = `Permission mode: ${store.state.permissionMode} (usage: /permission ${permissionModeSchema.options.join("|")})`;
      store.emit({ type: "ui.notice.posted", text });
    },
  },
  "/model": {
    description: "Pick a model, or set one with /model <name>",
    run(store, model) {
      if (model) return void requestAgent(store, { type: "agent.model.set.requested", model });
      requestAgent(store, { type: "agent.models.requested" });
    },
  },
  "/theme": {
    description: "Show or switch the color theme",
    run(store, argument) {
      if (!argument) return store.emit({ type: "ui.theme.picker.opened" });
      const parsed = themeNameSchema.safeParse(argument);
      if (parsed.success) return store.emit({ type: "ui.theme.selected", theme: parsed.data });
      store.emit({ type: "ui.notice.posted", text: `Unknown theme: ${argument}` });
    },
  },
  "/theme-background": {
    description: "Pick the app background color with RGBA sliders",
    run(store) {
      store.emit({ type: "ui.background.editor.opened" });
    },
  },
  "/session": {
    description: "Switch to a previous session",
    run(store) {
      store.request({ type: "session.list.requested" });
    },
  },
  "/cd": {
    description: "Change directory and start a fresh session there",
    run(store, path) {
      if (!path) {
        const text = `Directory: ${store.state.cwd} (usage: /cd <path>)`;
        return store.emit({ type: "ui.notice.posted", text });
      }
      if (guardIdle(store, "changing directory")) {
        store.request({ type: "workspace.cwd.set.requested", path });
      }
    },
  },
  "/effort": {
    description: "Show or set reasoning effort",
    run(store, level) {
      const parsed = effortLevelSchema.safeParse(level);
      if (parsed.success) {
        return void requestAgent(store, {
          type: "agent.effort.set.requested",
          effort: parsed.data,
        });
      }
      const options = effortLevelSchema.options.join("|");
      const text = `Effort: ${store.state.effort || "default"} (usage: /effort ${options})`;
      store.emit({ type: "ui.notice.posted", text });
    },
  },
  "/mcp": {
    description: "List MCP servers",
    run(store) {
      requestAgent(store, { type: "agent.mcp.status.requested" });
    },
  },
  "/clear": {
    description: "Start a fresh session",
    run(store) {
      store.request({ type: "session.create.requested" });
    },
  },
  "/quit": QUIT_COMMAND,
};
