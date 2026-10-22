import { type ApprovalDecision, findAwaitingCalls } from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";
import { isAgentBusy } from "./agentBusy.ts";
import { requestAgent } from "./agentRequest.ts";
import { isAgentCommand, runSlashCommand } from "./slashCommands.ts";

export type PromptDelivery = "send" | "queue" | "steer";

const DELIVERY_REQUESTS = {
  send: "agent.prompt.requested",
  queue: "agent.prompt.queue.requested",
  steer: "agent.prompt.steer.requested",
} as const;

const BUSY_NOTICE = "Agent is busy: Ctrl+Q queues, Ctrl+W steers, Esc Esc interrupts the turn";

function deliverPrompt(store: AppStore, content: string, delivery: PromptDelivery): boolean {
  const busy = isAgentBusy(store);
  if (busy && delivery === "send") {
    store.emit({ type: "ui.notice.posted", text: BUSY_NOTICE });
    return false;
  }
  return requestAgent(store, { type: DELIVERY_REQUESTS[busy ? delivery : "send"], content });
}

export function submitPrompt(
  store: AppStore,
  text: string,
  delivery: PromptDelivery = "send",
): boolean {
  const content = text.trim();
  if (!content) return false;
  if (content.startsWith("/") && !isAgentCommand(store.state, content)) {
    runSlashCommand(store, content);
    return true;
  }
  return deliverPrompt(store, content, delivery);
}

export function answerApproval(
  store: AppStore,
  decision: ApprovalDecision,
  toolUseId?: string,
): void {
  const target = toolUseId ?? findAwaitingCalls(store.state)[0]?.id;
  if (target)
    requestAgent(store, { type: "agent.tool.approval.answered", toolUseId: target, decision });
}

export function cancelTurn(store: AppStore): void {
  requestAgent(store, { type: "agent.prompt.cancel.requested" });
}
