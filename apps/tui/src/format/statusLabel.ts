import type { AgentStatus, ToolStatus } from "@claudin/events";
import { Theme } from "../theme/colors.ts";
import { APPROVAL_GLYPH, ERROR_GLYPH } from "./glyphs.ts";

export type AgentLabel = { icon?: string; text: string; color: string };

export function agentLabel(status: Exclude<AgentStatus, "idle">): AgentLabel {
  switch (status) {
    case "thinking":
      return { text: "Thinking…", color: Theme.status.warning };
    case "executing":
      return { text: "Executing…", color: Theme.status.info };
    case "approval_required":
      return { icon: APPROVAL_GLYPH, text: "Approval required", color: Theme.status.danger };
    case "answer_required":
      return { icon: APPROVAL_GLYPH, text: "Answer required", color: Theme.status.warning };
    case "error":
      return { icon: ERROR_GLYPH, text: "Error", color: Theme.status.danger };
  }
}

export function toolColor(status: ToolStatus): string {
  switch (status) {
    case "running":
      return Theme.status.info;
    case "completed":
      return Theme.status.success;
    case "failed":
      return Theme.status.danger;
    case "awaiting_approval":
    case "awaiting_answer":
      return Theme.status.warning;
  }
}
