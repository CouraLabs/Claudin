import type {
  McpServerStatus,
  ModelInfo,
  SDKControlGetUsageResponse,
  SDKSessionInfo,
  SessionMessage,
  SlashCommand,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { askedQuestionsSchema } from "../models/askedQuestion.ts";
import { sdkValue } from "../models/sdkValue.ts";
import {
  approvalDecisionSchema,
  effortLevelSchema,
  permissionModeSchema,
} from "../requests/agentRequestEvents.ts";

const agentSessionId = z.string();

export const agentResponseSchemas = [
  z.object({
    type: z.literal("agent.session.info.received"),
    info: sdkValue<SDKSessionInfo | undefined>(),
  }),
  z.object({
    type: z.literal("agent.session.messages.received"),
    messages: sdkValue<SessionMessage[]>(),
  }),
  z.object({ type: z.literal("agent.session.created"), agentSessionId }),
  z.object({ type: z.literal("agent.message.received"), message: z.unknown() }),
  z.object({ type: z.literal("agent.prompt.accepted"), agentSessionId }),
  z.object({ type: z.literal("agent.prompt.cancelled"), agentSessionId }),
  z.object({
    type: z.literal("agent.tool.approval.required"),
    agentSessionId,
    toolUseId: z.string(),
    toolName: z.string(),
    input: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("agent.tool.approval.resolved"),
    toolUseId: z.string(),
    decision: approvalDecisionSchema,
  }),
  z.object({
    type: z.literal("agent.question.required"),
    agentSessionId,
    toolUseId: z.string(),
    questions: askedQuestionsSchema,
  }),
  z.object({
    type: z.literal("agent.question.resolved"),
    toolUseId: z.string(),
    answered: z.boolean(),
  }),
  z.object({ type: z.literal("agent.model.changed"), model: z.string() }),
  z.object({ type: z.literal("agent.effort.changed"), effort: effortLevelSchema }),
  z.object({ type: z.literal("agent.permission_mode.changed"), mode: permissionModeSchema }),
  z.object({
    type: z.literal("agent.commands.received"),
    commands: sdkValue<SlashCommand[]>(),
  }),
  z.object({ type: z.literal("agent.models.received"), models: sdkValue<ModelInfo[]>() }),
  z.object({
    type: z.literal("agent.mcp.status.received"),
    servers: sdkValue<McpServerStatus[]>(),
  }),
  z.object({
    type: z.literal("agent.usage.received"),
    usage: sdkValue<SDKControlGetUsageResponse["session"]>(),
  }),
  z.object({
    type: z.literal("agent.rate_limit.received"),
    rateLimit: sdkValue<SDKControlGetUsageResponse["rate_limits"]>(),
  }),
  z.object({
    type: z.literal("agent.files.rewound"),
    userMessageId: z.string(),
    filesChanged: z.array(z.string()),
    insertions: z.number(),
    deletions: z.number(),
  }),
] as const;
