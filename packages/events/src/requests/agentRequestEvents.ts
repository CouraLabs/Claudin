import type {
  ForkSessionOptions,
  GetSessionInfoOptions,
  GetSessionMessagesOptions,
  Options,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { type PromptContent, sdkValue } from "../models/sdkValue.ts";

const agentSessionId = z.string();
const content = sdkValue<PromptContent>();
const agentOptions = sdkValue<Options>().optional();

export const effortLevelSchema = z.enum(["low", "medium", "high", "xhigh", "max"]);

export const permissionModeSchema = z.enum(["auto", "acceptEdits", "bypassPermissions", "dontAsk"]);

export type PermissionMode = z.infer<typeof permissionModeSchema>;

export const DEFAULT_PERMISSION_MODE: PermissionMode = "bypassPermissions";

export const PERMISSION_MODE_LABELS: Record<PermissionMode, string> = {
  acceptEdits: "Accept Edits Permission",
  bypassPermissions: "Bypass Permissions",
  dontAsk: "Don't Ask Permission",
  auto: "Automatic Permissions",
};

export const readPermissionLabel = (mode: string): string =>
  PERMISSION_MODE_LABELS[mode as PermissionMode] ?? mode;

export const approvalDecisionSchema = z.enum(["approve", "approve_all", "reject"]);

export const agentRequestSchemas = [
  z.object({
    type: z.literal("agent.session.info.requested"),
    agentSessionId,
    options: sdkValue<GetSessionInfoOptions>().optional(),
  }),
  z.object({
    type: z.literal("agent.session.messages.requested"),
    agentSessionId,
    options: sdkValue<GetSessionMessagesOptions>().optional(),
  }),
  z.object({ type: z.literal("agent.session.create.requested"), options: agentOptions }),
  z.object({
    type: z.literal("agent.session.resume.requested"),
    agentSessionId,
    options: agentOptions,
  }),
  z.object({
    type: z.literal("agent.session.fork.requested"),
    agentSessionId,
    forkOptions: sdkValue<ForkSessionOptions>().optional(),
    options: agentOptions,
  }),
  z.object({ type: z.literal("agent.prompt.requested"), agentSessionId, content }),
  z.object({ type: z.literal("agent.prompt.queue.requested"), agentSessionId, content }),
  z.object({ type: z.literal("agent.prompt.steer.requested"), agentSessionId, content }),
  z.object({ type: z.literal("agent.prompt.cancel.requested"), agentSessionId }),
  z.object({
    type: z.literal("agent.tool.approval.answered"),
    agentSessionId,
    toolUseId: z.string(),
    decision: approvalDecisionSchema,
  }),
  z.object({
    type: z.literal("agent.question.answered"),
    agentSessionId,
    toolUseId: z.string(),
    answers: z.record(z.string(), z.string()),
  }),
  z.object({ type: z.literal("agent.model.set.requested"), agentSessionId, model: z.string() }),
  z.object({
    type: z.literal("agent.permission_mode.set.requested"),
    agentSessionId,
    mode: permissionModeSchema,
  }),
  z.object({
    type: z.literal("agent.effort.set.requested"),
    agentSessionId,
    effort: effortLevelSchema,
  }),
  z.object({ type: z.literal("agent.commands.requested"), agentSessionId }),
  z.object({ type: z.literal("agent.models.requested"), agentSessionId }),
  z.object({ type: z.literal("agent.mcp.status.requested"), agentSessionId }),
  z.object({
    type: z.literal("agent.mcp.login.requested"),
    agentSessionId,
    serverName: z.string(),
  }),
  z.object({
    type: z.literal("agent.mcp.callback.submitted"),
    agentSessionId,
    serverName: z.string(),
    callbackUrl: z.string(),
  }),
  z.object({ type: z.literal("agent.usage.requested"), agentSessionId }),
  z.object({ type: z.literal("agent.rate_limit.requested"), agentSessionId }),
  z.object({ type: z.literal("agent.rate_limit.cached.requested") }),
  z.object({
    type: z.literal("agent.files.rewind.requested"),
    agentSessionId,
    userMessageId: z.string(),
  }),
] as const;
