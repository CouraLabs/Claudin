import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";

export const allowTool = (input: Record<string, unknown>): PermissionResult => ({
  behavior: "allow",
  updatedInput: input,
});

export const denyTool = (message: string): PermissionResult => ({ behavior: "deny", message });
