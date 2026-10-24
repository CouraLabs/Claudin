import { type ApprovalDecision, findAwaitingCalls } from "@kraude-kode/events";
import type { ImageBlock } from "../prompt/imageBlock.ts";
import type { AppStore } from "../store/appStore.ts";
import { isAgentBusy } from "./agentBusy.ts";
import { requestAgent } from "./agentRequest.ts";
import { isAgentCommand, runSlashCommand } from "./slashCommands.ts";

export type PromptDelivery = "send" | "queue";

const buildContent = (text: string, images: ImageBlock[]) =>
  images.length > 0 ? [{ type: "text" as const, text }, ...images] : text;

function deliverPrompt(
  store: AppStore,
  content: string,
  delivery: PromptDelivery,
  images: ImageBlock[],
): boolean {
  const body = buildContent(content, images);
  if (delivery === "queue" && isAgentBusy(store)) {
    store.emit({ type: "ui.prompt.queued", content: body });
    return true;
  }
  return requestAgent(store, { type: "agent.prompt.requested", content: body });
}

export function sendNextQueuedPrompt(store: AppStore): void {
  const [next] = store.state.queuedPrompts;
  if (next === undefined || store.state.status !== "idle") return;
  const sent = requestAgent(store, { type: "agent.prompt.requested", content: next }, "ignore");
  if (sent) store.emit({ type: "ui.prompt.dequeued" });
}

export function submitPrompt(
  store: AppStore,
  text: string,
  delivery: PromptDelivery = "send",
  images: ImageBlock[] = [],
): boolean {
  const content = text.trim();
  if (!content && images.length === 0) return false;
  if (content.startsWith("/") && !isAgentCommand(store.state, content)) {
    runSlashCommand(store, content);
    return true;
  }
  return deliverPrompt(store, content, delivery, images);
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

export function stopTask(store: AppStore, taskId: string): void {
  requestAgent(store, { type: "agent.task.stop.requested", taskId });
}

export function cancelTurn(store: AppStore): void {
  requestAgent(store, { type: "agent.prompt.cancel.requested" });
}
