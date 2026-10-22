import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

export type PromptContent = SDKUserMessage["message"]["content"];

export const sdkValue = <T>() => z.custom<T>();
export type { SDKMessage, SlashCommand } from "@anthropic-ai/claude-agent-sdk";
