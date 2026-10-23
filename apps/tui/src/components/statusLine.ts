import type { LastRun, SessionState } from "@claudin/events";
import {
  BoxRenderable,
  bold,
  type CliRenderer,
  dim,
  fg,
  StyledText,
  TextRenderable,
} from "@opentui/core";
import { formatDuration, formatTokenCount } from "../format/formatMetrics.ts";
import { DONE_GLYPH, SEPARATOR, SPINNER_FRAMES } from "../format/glyphs.ts";
import { agentLabel } from "../format/statusLabel.ts";
import { summarizePrompt } from "../format/summarizePrompt.ts";
import { Theme } from "../theme/colors.ts";

const SPINNER_STEP_MS = 100;

const formatToolCount = (count: number): string => `${count} ${count === 1 ? "tool" : "tools"}`;

const readLastPrompt = ({ transcript }: SessionState): string => {
  const last = transcript.findLast((entry) => entry.kind === "user");
  return last?.kind === "user" ? summarizePrompt(last.text) : "";
};

const buildLastRunChunks = ({ durationMs, toolCount }: LastRun, prompt: string) => [
  fg(Theme.status.success)(`${DONE_GLYPH} `),
  fg(Theme.fg.muted)(`${formatDuration(durationMs)}${SEPARATOR}${formatToolCount(toolCount)}`),
  ...(prompt ? [fg(Theme.border.separator)(SEPARATOR), fg(Theme.fg.secondary)(prompt)] : []),
];

export class StatusLine {
  readonly renderable: BoxRenderable;
  readonly label: TextRenderable;
  readonly stats: TextRenderable;

  constructor(renderer: CliRenderer, onStop: () => void) {
    this.renderable = new BoxRenderable(renderer, {
      height: 2,
      flexShrink: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      border: ["top"],
      borderColor: Theme.border.subtle,
      paddingLeft: 2,
      paddingRight: 2,
      visible: false,
    });
    this.label = new TextRenderable(renderer, { content: "", wrapMode: "none" });
    this.stats = new TextRenderable(renderer, {
      content: "",
      wrapMode: "none",
      flexShrink: 0,
      selectable: false,
      onMouseDown: onStop,
    });
    this.renderable.add(this.label);
    this.renderable.add(this.stats);
  }

  update(state: SessionState): void {
    if (state.status === "idle") {
      this.label.content = state.lastRun
        ? new StyledText(buildLastRunChunks(state.lastRun, readLastPrompt(state)))
        : "";
      this.renderable.visible = state.lastRun !== undefined;
      this.stats.content = "";
      return;
    }
    this.renderable.visible = true;
    const label = agentLabel(state.status);
    const busy = label.icon === undefined;
    const frame = SPINNER_FRAMES[Math.floor(state.now / SPINNER_STEP_MS) % SPINNER_FRAMES.length];
    const elapsed = state.turnStartedAt ? formatDuration(state.now - state.turnStartedAt) : "";
    this.label.content = new StyledText([
      fg(label.color)(`${busy ? frame : label.icon} ${label.text}`),
      ...(busy ? [dim(fg(Theme.fg.muted)(" (esc esc)"))] : []),
    ]);
    const showStats = state.status !== "error";
    this.stats.content = showStats
      ? new StyledText([
          fg(Theme.fg.muted)(`${elapsed} ↓${formatTokenCount(state.tokens.output)} `),
          bold(fg(Theme.fg.secondary)("[stop]")),
        ])
      : "";
  }
}
