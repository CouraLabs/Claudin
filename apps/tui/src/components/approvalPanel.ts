import type { ApprovalDecision, ToolCall } from "@kraude-kode/events";
import {
  BoxRenderable,
  bold,
  type CliRenderer,
  fg,
  StyledText,
  TextRenderable,
} from "@opentui/core";
import { describeApproval } from "../format/toolSummary.ts";
import { Theme } from "../theme/colors.ts";

type DecisionHandler = (decision: ApprovalDecision) => void;

type ButtonSpec = { label: string; decision: ApprovalDecision; color: string };

const buildButtons = (): ButtonSpec[] => [
  { label: "[A] Approve All", decision: "approve_all", color: Theme.status.info },
  { label: "[Y] Approve Single", decision: "approve", color: Theme.status.success },
  { label: "[N] Reject", decision: "reject", color: Theme.status.danger },
];

export class ApprovalPanel {
  readonly renderable: BoxRenderable;
  readonly prompt: TextRenderable;

  constructor(renderer: CliRenderer, onDecision: DecisionHandler) {
    this.renderable = new BoxRenderable(renderer, {
      flexDirection: "column",
      marginTop: 1,
      flexShrink: 0,
    });
    this.prompt = new TextRenderable(renderer, { content: "" });
    const buttons = new BoxRenderable(renderer, { flexDirection: "row", gap: 3 });
    for (const { label, decision, color } of buildButtons()) {
      buttons.add(
        new TextRenderable(renderer, {
          content: new StyledText([bold(fg(color)(label))]),
          selectable: false,
          onMouseDown: () => onDecision(decision),
        }),
      );
    }
    this.renderable.add(this.prompt);
    this.renderable.add(buttons);
  }

  update(call: ToolCall): void {
    const text = `>>> APPROVAL REQUIRED: ${describeApproval(call)}`;
    this.prompt.content = new StyledText([bold(fg(Theme.status.warning)(text))]);
  }
}
