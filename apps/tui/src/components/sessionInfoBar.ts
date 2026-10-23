import type { SessionState } from "@claudin/events";
import { BoxRenderable, type CliRenderer, StyledText, TextRenderable } from "@opentui/core";
import { buildRateLimitChunks } from "../format/rateLimitChunks.ts";
import { buildSessionInfoChunks } from "../format/sessionInfoChunks.ts";

export class SessionInfoBar {
  readonly renderable: BoxRenderable;
  readonly info: TextRenderable;
  readonly limits: TextRenderable;

  constructor(renderer: CliRenderer) {
    this.renderable = new BoxRenderable(renderer, {
      flexShrink: 0,
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 1,
      columnGap: 0,
      justifyContent: "space-between",
      paddingLeft: 2,
      paddingRight: 2,
    });
    this.info = new TextRenderable(renderer, { content: "", wrapMode: "none", flexShrink: 0 });
    this.limits = new TextRenderable(renderer, {
      content: "",
      wrapMode: "none",
      flexShrink: 0,
      marginLeft: 2,
    });
    this.renderable.add(this.info);
    this.renderable.add(this.limits);
  }

  update(state: SessionState): void {
    this.info.content = new StyledText(buildSessionInfoChunks(state));
    this.limits.content = new StyledText(buildRateLimitChunks(state.rateLimits, state.now));
  }
}
