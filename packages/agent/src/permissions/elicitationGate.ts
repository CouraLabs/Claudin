import type {
  ElicitationRequest,
  ElicitationResult,
  OnElicitation,
} from "@anthropic-ai/claude-agent-sdk";
import type { AskedQuestion, ResponseEvent } from "@kraude-kode/events";
import { openBrowser } from "../system/openBrowser.ts";
import {
  buildElicitationContent,
  buildElicitationForm,
  type ElicitationForm,
  isConfirmAccepted,
} from "./elicitationForm.ts";
import { sanitizeText } from "./sanitizeText.ts";

export const ELICITATION_PREFIX = "elicitation:";

export const OPEN_BROWSER_LABEL = "Open in browser";

const DECLINED: ElicitationResult = { action: "decline" };

type Pending = {
  settle: (result: ElicitationResult) => void;
  accept: (answers: Record<string, string>) => ElicitationResult;
};

type Emit = (event: ResponseEvent) => void;

type OpenUrl = (url: string) => Promise<unknown>;

const isWebUrl = (url: string | undefined): url is string => {
  try {
    return url !== undefined && /^https?:$/.test(new URL(url).protocol);
  } catch {
    return false;
  }
};

const buildUrlQuestion = ({ serverName, message, url }: ElicitationRequest): AskedQuestion => ({
  header: sanitizeText(serverName),
  question: `${sanitizeText(message)} ${sanitizeText(url)}`,
  options: [
    { label: OPEN_BROWSER_LABEL, description: "" },
    { label: "Decline", description: "" },
  ],
});

export class ElicitationGate {
  readonly pending = new Map<string, Pending>();
  emit: Emit = () => {};

  constructor(
    private agentSessionId: string,
    private openUrl: OpenUrl = openBrowser,
  ) {}

  listen(emit: Emit): void {
    this.emit = emit;
  }

  readonly handle: OnElicitation = async (request, { signal, requestId }) => {
    if (request.mode === "url") {
      if (!isWebUrl(request.url)) return DECLINED;
      return this.open(requestId, signal, [buildUrlQuestion(request)], (answers) =>
        this.acceptUrl(request.url as string, answers),
      );
    }
    const form = buildElicitationForm(request.serverName, request.message, request.requestedSchema);
    return this.open(requestId, signal, form.questions, (answers) =>
      this.acceptForm(form, answers),
    );
  };

  answer(toolUseId: string, answers: Record<string, string>): boolean {
    const pending = this.pending.get(toolUseId);
    if (!pending) return false;
    this.pending.delete(toolUseId);
    const answered = Object.keys(answers).length > 0;
    pending.settle(answered ? pending.accept(answers) : DECLINED);
    this.emit({ type: "agent.question.resolved", toolUseId, answered });
    return true;
  }

  rejectAll(): void {
    for (const id of [...this.pending.keys()]) this.answer(id, {});
  }

  private acceptUrl(url: string, answers: Record<string, string>): ElicitationResult {
    if (!Object.values(answers).includes(OPEN_BROWSER_LABEL)) return DECLINED;
    void this.openUrl(url);
    return { action: "accept" };
  }

  private acceptForm(form: ElicitationForm, answers: Record<string, string>): ElicitationResult {
    if (!isConfirmAccepted(form, answers)) return DECLINED;
    return { action: "accept", content: buildElicitationContent(form, answers) };
  }

  private open(
    requestId: string,
    signal: AbortSignal,
    questions: AskedQuestion[],
    accept: Pending["accept"],
  ): Promise<ElicitationResult> {
    const toolUseId = `${ELICITATION_PREFIX}${requestId}`;
    return new Promise((settle) => {
      this.pending.set(toolUseId, { settle, accept });
      signal.addEventListener("abort", () => this.answer(toolUseId, {}), { once: true });
      this.emit({
        type: "agent.question.required",
        agentSessionId: this.agentSessionId,
        toolUseId,
        questions,
      });
    });
  }
}
