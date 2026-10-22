import { fg, type TextChunk } from "@opentui/core";
import { Theme } from "../theme/colors.ts";
import { buildGauge, formatTokenCount } from "./formatMetrics.ts";
import { CONTEXT_GLYPH } from "./glyphs.ts";
import { readUsageColor } from "./statusColors.ts";

export function buildContextChunks(used: number, max: number): TextChunk[] {
  const ratio = max > 0 ? Math.min(used / max, 1) : 0;
  return [
    fg(Theme.accent.highlight)(`${CONTEXT_GLYPH} `),
    fg(Theme.fg.muted)(`${Math.round(ratio * 100)}% `),
    fg(readUsageColor(ratio))(buildGauge(ratio)),
    fg(Theme.fg.muted)(` ${formatTokenCount(used)}/`),
    fg(Theme.accent.highlight)(formatTokenCount(max)),
  ];
}
