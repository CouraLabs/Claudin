import { effortLevelSchema, permissionModeSchema, themeNameSchema } from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";
import { guardIdle } from "./agentBusy.ts";
import { requestAgent } from "./agentRequest.ts";
import { saveTheme } from "./themeActions.ts";
import { type SlashCommand, WORKFLOW_COMMANDS } from "./workflowCommands.ts";

export function openModelPicker(store: AppStore): void {
  requestAgent(store, { type: "agent.models.requested" });
}

const QUIT_COMMAND: SlashCommand = {
  description: "Exit the app (also /exit, /q, /leave)",
  run: (store) => store.emit({ type: "ui.exit.requested" }),
};

const MCP_USAGE = "Usage: /mcp | /mcp login <name> | /mcp callback <name> <url>";

function runMcpCommand(store: AppStore, argument: string): void {
  const [action, serverName, callbackUrl] = argument.trim().split(/\s+/);
  if (!action) return void requestAgent(store, { type: "agent.mcp.status.requested" });
  if (action === "login" && serverName) {
    return void requestAgent(store, { type: "agent.mcp.login.requested", serverName });
  }
  if (action === "callback" && serverName && callbackUrl) {
    return void requestAgent(store, {
      type: "agent.mcp.callback.submitted",
      serverName,
      callbackUrl,
    });
  }
  store.emit({ type: "ui.notice.posted", text: MCP_USAGE });
}

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
      openModelPicker(store);
    },
  },
  "/theme": {
    description: "Show or switch the color theme",
    run(store, argument) {
      if (!argument) return store.emit({ type: "ui.theme.picker.opened" });
      const parsed = themeNameSchema.safeParse(argument);
      if (parsed.success) return saveTheme(store, parsed.data);
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
    description: "Pick a reasoning effort, or set one with /effort <level>",
    run(store, level) {
      if (!level) return store.emit({ type: "ui.effort.picker.opened" });
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
    description: "List MCP servers, sign in with /mcp login <name>, or /mcp callback <name> <url>",
    run: runMcpCommand,
  },
  "/clear": {
    description: "Start a fresh session",
    run(store) {
      store.request({ type: "session.create.requested" });
    },
  },
  ...WORKFLOW_COMMANDS,
  "/quit": QUIT_COMMAND,
};
