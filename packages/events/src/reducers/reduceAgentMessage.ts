import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SessionState } from "../session/sessionState.ts";
import { appendNotice } from "./appendEntry.ts";
import { describeSystemMessage } from "./describeSystemMessage.ts";
import { reduceAssistant } from "./reduceAssistant.ts";
import { isPromptEcho, reduceCheckpoint } from "./reduceCheckpoint.ts";
import { reduceRateLimitEvent } from "./reduceRateLimit.ts";
import { reduceResult } from "./reduceResult.ts";
import { reduceStreamEvent } from "./reduceStreamEvent.ts";
import { reduceToolResults } from "./reduceToolResults.ts";

export function reduceAgentMessage(state: SessionState, message: SDKMessage): SessionState {
  switch (message.type) {
    case "system":
      if (message.subtype !== "init") return reduceNoticeMessage(state, message);
      return {
        ...state,
        model: message.model,
        cwd: message.cwd,
        permissionMode: message.permissionMode,
        effort: message.effort ?? state.effort,
      };
    case "stream_event":
      if (message.parent_tool_use_id) return state;
      return reduceStreamEvent(state, message.event as Parameters<typeof reduceStreamEvent>[1]);
    case "assistant":
      return reduceAssistant(state, message);
    case "user":
      return isPromptEcho(message)
        ? reduceCheckpoint(state, message)
        : reduceToolResults(state, message);
    case "result":
      return reduceResult(state, message);
    case "rate_limit_event":
      return reduceRateLimitEvent(state, message);
    default:
      return reduceNoticeMessage(state, message);
  }
}

function reduceNoticeMessage(state: SessionState, message: SDKMessage): SessionState {
  const text = describeSystemMessage(message);
  return text ? appendNotice(state, text) : state;
}
