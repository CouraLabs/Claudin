import { countContextTokens, type SessionState } from "@claudin/events";
import {
  BoxRenderable,
  type CliRenderer,
  fg,
  StyledText,
  type TextChunk,
  TextRenderable,
} from "@opentui/core";
import { buildContextChunks } from "../format/contextChunks.ts";
import { BRANCH_GLYPH, SEPARATOR } from "../format/glyphs.ts";
import { tildePath } from "../format/shortenPath.ts";
import { Theme } from "../theme/colors.ts";

const joinSegments = (segments: TextChunk[][]): TextChunk[] =>
  segments.flatMap((segment, index) =>
    index === 0 ? segment : [fg(Theme.fg.muted)(SEPARATOR), ...segment],
  );

function buildLocationChunks({ cwd, gitBranch, gitStats }: SessionState): TextChunk[] {
  const segments: TextChunk[][] = [[fg(Theme.accent.highlight)(cwd ? tildePath(cwd) : "…")]];
  if (gitBranch) {
    segments.push(
      [fg(Theme.accent.highlight)(`${BRANCH_GLYPH} ${gitBranch}`)],
      [
        fg(Theme.status.success)(`+${gitStats.additions}`),
        fg(Theme.fg.muted)(" "),
        fg(Theme.status.danger)(`-${gitStats.deletions}`),
      ],
    );
  }
  return joinSegments(segments);
}

export class HeaderBar {
  readonly renderable: BoxRenderable;
  readonly location: TextRenderable;
  readonly meter: TextRenderable;

  constructor(renderer: CliRenderer) {
    this.renderable = new BoxRenderable(renderer, {
      height: 2,
      marginTop: 1,
      flexShrink: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      border: ["bottom"],
      paddingLeft: 1,
      paddingRight: 1,
    });
    this.location = new TextRenderable(renderer, { content: "", wrapMode: "none" });
    this.meter = new TextRenderable(renderer, { content: "", wrapMode: "none", flexShrink: 0 });
    this.renderable.add(this.location);
    this.renderable.add(this.meter);
  }

  update(state: SessionState): void {
    const used = countContextTokens(state.tokens);
    this.renderable.backgroundColor = Theme.bg.header;
    this.renderable.borderColor = Theme.border.subtle;
    this.location.content = new StyledText(buildLocationChunks(state));
    this.meter.content = new StyledText(buildContextChunks(used, state.tokens.maxContext));
  }
}
