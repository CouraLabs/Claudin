import {
  readCacheHitPercent,
  readModelLabel,
  readPermissionLabel,
  type SessionState,
} from "@claudin/events";
import { dim, fg, type TextChunk } from "@opentui/core";
import { Theme } from "../theme/colors.ts";
import { formatCost, formatTokenCount } from "./formatMetrics.ts";
import { EFFORT_GLYPHS, PERMISSION_GLYPH, SEPARATOR, TOKEN_GLYPHS } from "./glyphs.ts";
import { readEffortColor, readPermissionColor } from "./statusColors.ts";

type Setting = { text: string; color: string; hint?: string };

const MODEL_HINT = " (shift+tab)";

const buildEffortText = (effort: string): string =>
  [EFFORT_GLYPHS[effort], effort].filter(Boolean).join(" ");

const buildSettings = (state: SessionState): Setting[] =>
  [
    { text: readModelLabel(state), color: Theme.fg.primary, hint: MODEL_HINT },
    { text: buildEffortText(state.effort), color: readEffortColor(state.effort) },
    { text: formatCost(state.costUsd), color: Theme.status.warning },
    {
      text: `${PERMISSION_GLYPH} ${readPermissionLabel(state.permissionMode).replace(/\s*Permissions?$/, "")}`,
      color: readPermissionColor(state.permissionMode),
    },
  ].filter(({ text }) => text.trim());

const buildTokenChunks = ({ tokens }: SessionState): TextChunk[] => {
  const entries: [string, string, string][] = [
    [TOKEN_GLYPHS.input, Theme.status.info, formatTokenCount(tokens.input)],
    [TOKEN_GLYPHS.output, Theme.status.success, formatTokenCount(tokens.output)],
    [TOKEN_GLYPHS.cacheWrite, Theme.status.warning, formatTokenCount(tokens.cacheWrite)],
    [TOKEN_GLYPHS.cacheRead, Theme.accent.highlight, formatTokenCount(tokens.cacheRead)],
    [TOKEN_GLYPHS.cacheHit, Theme.accent.brand, `${readCacheHitPercent(tokens)}%`],
  ];
  return entries.flatMap(([glyph, color, value], index) => [
    fg(Theme.fg.muted)(index > 0 ? " " : ""),
    fg(color)(glyph),
    fg(Theme.fg.muted)(`${value}`),
  ]);
};

export const buildSessionInfoChunks = (state: SessionState): TextChunk[] => [
  ...buildSettings(state).flatMap(({ text, color, hint }, index) => [
    ...(index > 0 ? [fg(Theme.border.separator)(SEPARATOR)] : []),
    fg(color)(text),
    ...(hint ? [dim(fg(Theme.fg.muted)(hint))] : []),
  ]),
  fg(Theme.border.separator)(SEPARATOR),
  ...buildTokenChunks(state),
];
