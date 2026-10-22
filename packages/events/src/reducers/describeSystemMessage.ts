import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const formatTokens = (count: number): string => `${count.toLocaleString("en-US")} tokens`;

const describeCompaction = (
  metadata: Extract<SDKMessage, { subtype: "compact_boundary" }>["compact_metadata"],
): string => {
  const after =
    metadata.post_tokens === undefined ? "" : ` → ${formatTokens(metadata.post_tokens)}`;
  return `Conversation compacted (${metadata.trigger}): ${formatTokens(metadata.pre_tokens)}${after}`;
};

const describeStatus = (
  message: Extract<SDKMessage, { subtype: "status" }>,
): string | undefined => {
  if (message.status === "compacting") return "Compacting conversation...";
  if (message.compact_result !== "failed") return undefined;
  return `Compaction failed${message.compact_error ? `: ${message.compact_error}` : ""}`;
};

const describeSystem = (message: Extract<SDKMessage, { type: "system" }>): string | undefined => {
  switch (message.subtype) {
    case "local_command_output":
    case "informational":
    case "model_refusal_fallback":
    case "model_refusal_no_fallback":
      return message.content;
    case "compact_boundary":
      return describeCompaction(message.compact_metadata);
    case "status":
      return describeStatus(message);
    case "api_retry":
      return `API error (${message.error}), retrying ${message.attempt}/${message.max_retries}`;
    case "notification":
      return message.text;
    case "permission_denied":
      return `Permission denied for ${message.tool_name}: ${message.message}`;
    case "plugin_install":
      return message.status === "failed"
        ? `Plugin ${message.name ?? ""} install failed: ${message.error ?? "unknown error"}`
        : undefined;
    case "task_notification":
      return message.skip_transcript ? undefined : `Task ${message.status}: ${message.summary}`;
    case "hook_response":
      return message.outcome === "error"
        ? `Hook ${message.hook_name} failed: ${message.stderr || message.output}`.trim()
        : undefined;
    case "mirror_error":
      return `Transcript mirror error: ${message.error}`;
    default:
      return undefined;
  }
};

export function describeSystemMessage(message: SDKMessage): string | undefined {
  if (message.type === "system") return describeSystem(message)?.trim() || undefined;
  if (message.type === "conversation_reset") return "Conversation reset";
  return undefined;
}
