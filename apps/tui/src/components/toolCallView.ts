import type { ApprovalDecision, QuestionDraft, ToolCall } from "@claudin/events";
import {
  BoxRenderable,
  bold,
  type CliRenderer,
  DiffRenderable,
  fg,
  StyledText,
  type SyntaxStyle,
  TextRenderable,
} from "@opentui/core";
import { formatDuration } from "../format/formatMetrics.ts";
import { COLLAPSE_GLYPHS } from "../format/glyphs.ts";
import { toolColor } from "../format/statusLabel.ts";
import { buildToolDiff, type ToolDiff } from "../format/toolDiff.ts";
import { formatToolInput } from "../format/toolInputText.ts";
import { summarizeToolCall } from "../format/toolSummary.ts";
import { clipLines } from "../format/truncateText.ts";
import { Theme } from "../theme/colors.ts";
import { ApprovalPanel } from "./approvalPanel.ts";
import { createDiffView } from "./createDiffView.ts";
import { QuestionPanel } from "./questionPanel.ts";

const OUTPUT_LINES = 6;
const COMMAND_LINES = 4;

export type ToolCallHooks = {
  syntaxStyle: SyntaxStyle;
  onDecision: (decision: ApprovalDecision, toolUseId: string) => void;
  onToggle: (toolUseId: string) => void;
  onSelectRow: (index: number) => void;
};

export class ToolCallView {
  readonly renderable: BoxRenderable;
  readonly title: TextRenderable;
  readonly duration: TextRenderable;
  readonly body: BoxRenderable;
  readonly command: TextRenderable;
  readonly output: TextRenderable;
  readonly approval: ApprovalPanel;
  readonly question: QuestionPanel;
  diff?: DiffRenderable;
  call?: ToolCall;
  toolDiff?: ToolDiff;
  hovered = false;
  draft?: QuestionDraft | null;
  callId = "";
  elapsed = "";

  constructor(
    private renderer: CliRenderer,
    private hooks: ToolCallHooks,
  ) {
    this.renderable = new BoxRenderable(renderer, { flexDirection: "column", flexShrink: 0 });
    const toggle = () => hooks.onToggle(this.callId);
    const header = new BoxRenderable(renderer, {
      flexDirection: "row",
      justifyContent: "space-between",
      onMouseDown: toggle,
      onMouseOver: () => this.setHovered(true),
      onMouseOut: () => this.setHovered(false),
    });
    this.title = new TextRenderable(renderer, {
      content: "",
      wrapMode: "none",
      flexShrink: 1,
      selectable: false,
    });
    this.duration = new TextRenderable(renderer, {
      content: "",
      flexShrink: 0,
      marginLeft: 2,
      selectable: false,
    });
    header.add(this.title);
    header.add(this.duration);
    this.body = new BoxRenderable(renderer, { flexDirection: "column", paddingLeft: 2 });
    this.command = new TextRenderable(renderer, { content: "", fg: Theme.fg.secondary });
    this.output = new TextRenderable(renderer, { content: "" });
    this.approval = new ApprovalPanel(renderer, (decision) =>
      hooks.onDecision(decision, this.callId),
    );
    this.question = new QuestionPanel(renderer, (index) => hooks.onSelectRow(index));
    this.body.add(this.command);
    this.body.add(this.output);
    this.renderable.add(header);
    this.renderable.add(this.body);
    this.renderable.add(this.approval.renderable);
    this.renderable.add(this.question.renderable);
  }

  update(call: ToolCall, now: number, draft: QuestionDraft | null): void {
    if (call !== this.call) this.renderCall(call);
    if (call !== this.call || draft !== this.draft) this.renderQuestion(call, draft);
    this.renderDuration(call, now);
  }

  renderCall(call: ToolCall): void {
    this.call = call;
    this.callId = call.id;
    const diff = buildToolDiff(call);
    this.toolDiff = diff;
    this.renderTitle(call, diff);
    this.renderBody(call, diff);
    const awaiting = call.status === "awaiting_approval";
    this.approval.renderable.visible = awaiting;
    if (awaiting) this.approval.update(call);
  }

  renderQuestion(call: ToolCall, draft: QuestionDraft | null): void {
    this.draft = draft;
    const asking = call.status === "awaiting_answer" && draft?.toolUseId === call.id;
    this.question.renderable.visible = asking;
    if (asking && draft) this.question.update(draft);
  }

  renderDuration(call: ToolCall, now: number): void {
    const elapsed = formatDuration((call.endedAt ?? now) - call.startedAt);
    if (elapsed === this.elapsed) return;
    this.elapsed = elapsed;
    this.duration.content = new StyledText([fg(Theme.fg.muted)(elapsed)]);
  }

  setHovered(hovered: boolean): void {
    this.hovered = hovered;
    if (this.call) this.renderTitle(this.call, this.toolDiff);
  }

  renderTitle(call: ToolCall, diff?: ToolDiff): void {
    const stats = diff ? ` (+${diff.additions} -${diff.deletions})` : "";
    const glyph = call.expanded ? COLLAPSE_GLYPHS.expanded : COLLAPSE_GLYPHS.collapsed;
    const accent = this.hovered ? Theme.accent.brand : undefined;
    this.title.content = new StyledText([
      fg(accent ?? toolColor(call.status))(glyph),
      bold(fg(accent ?? Theme.fg.primary)(call.name)),
      fg(Theme.fg.secondary)(` ${summarizeToolCall(call)}`),
      fg(Theme.fg.muted)(stats),
    ]);
  }

  renderBody(call: ToolCall, diff: ToolDiff | undefined): void {
    const command = this.readCommand(call, diff);
    const result = call.error ?? call.output ?? "";
    const showResult = Boolean(result) && !diff;
    this.body.visible = call.expanded && Boolean(command || diff || showResult);
    this.command.visible = Boolean(command);
    this.command.content = command;
    this.output.visible = showResult;
    this.output.content = new StyledText([
      fg(call.error ? Theme.status.danger : Theme.fg.muted)(clipLines(result, OUTPUT_LINES)),
    ]);
    this.syncDiff(diff);
  }

  readCommand(call: ToolCall, diff: ToolDiff | undefined): string {
    if (call.name === "Bash")
      return `$ ${clipLines(String(call.input.command ?? ""), COMMAND_LINES)}`;
    return diff ? "" : clipLines(formatToolInput(call), COMMAND_LINES * 2);
  }

  syncDiff(diff?: ToolDiff): void {
    if (!diff) {
      if (this.diff) this.diff.visible = false;
      return;
    }
    if (this.diff) {
      this.diff.visible = true;
      this.diff.diff = diff.patch;
      return;
    }
    this.diff = createDiffView(this.renderer, this.hooks.syntaxStyle, diff.patch, diff.filetype);
    this.body.add(this.diff);
  }
}
