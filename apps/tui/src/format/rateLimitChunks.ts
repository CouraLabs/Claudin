import type { RateLimits, RateWindow } from "@claudin/events";
import { fg, type TextChunk } from "@opentui/core";
import { Theme } from "../theme/colors.ts";
import { buildGauge, formatTimeUntil } from "./formatMetrics.ts";
import { SEPARATOR } from "./glyphs.ts";
import { readUsageColor } from "./statusColors.ts";

const buildWindowChunks = (label: string, window: RateWindow, now: number): TextChunk[] => {
  const ratio = window.utilization / 100;
  return [
    fg(Theme.accent.highlight)(`${label}`),
    fg(Theme.fg.muted)(` ${Math.round(window.utilization)}% `),
    fg(readUsageColor(ratio))(buildGauge(ratio)),
    fg(Theme.border.separator)(" in "),
    fg(Theme.status.info)(`${formatTimeUntil(window.resetsAt, now)}`),
  ];
};

export function buildRateLimitChunks(limits: RateLimits, now: number) {
  const windows: [string, RateWindow | undefined][] = [
    ["➄", limits.fiveHour],
    ["❼", limits.sevenDay],
  ];
  return windows.flatMap(([label, window], index) =>
    window
      ? [
          ...(index > 0 ? [fg(Theme.border.separator)(SEPARATOR)] : []),
          ...buildWindowChunks(label, window, now),
        ]
      : [],
  );
}
