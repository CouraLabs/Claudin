import type { AgentStatus, ToolStatus } from "@kraude-kode/events";
import { Theme } from "../theme/colors.ts";
import { formatTimeUntil } from "./formatMetrics.ts";
import { APPROVAL_GLYPH, ERROR_GLYPH, LIMIT_GLYPH } from "./glyphs.ts";

export type AgentLabel = { icon?: string; text: string; color: string };

export function agentLabel(
  status: Exclude<AgentStatus, "idle">,
  resetsAt?: number,
  now?: number,
): AgentLabel {
  const clock = now ?? Date.now();
  switch (status) {
    case "thinking":
      return { text: "Thinking…", color: Theme.status.warning };
    case "executing":
      return { text: "Executing…", color: Theme.status.info };
    case "approval_required":
      return { icon: APPROVAL_GLYPH, text: "Approval required", color: Theme.status.danger };
    case "answer_required":
      return { icon: APPROVAL_GLYPH, text: "Answer required", color: Theme.status.warning };
    case "rate_limited":
      return resetsAt
        ? {
            icon: LIMIT_GLYPH,
            text: `Usage limit reached — resuming in ${formatTimeUntil(resetsAt, clock)}`,
            color: Theme.status.warning,
          }
        : {
            icon: LIMIT_GLYPH,
            text: "Usage limit reached — waiting to resume",
            color: Theme.status.warning,
          };
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
