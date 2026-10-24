import { BACKGROUND_CHANNELS, type BackgroundEditor, CHANNEL_MAX } from "@kraude-kode/events";
import { bold, dim, fg, type TextChunk } from "@opentui/core";
import { toBackgroundHex } from "../theme/color.ts";
import { Theme } from "../theme/colors.ts";
import { buildGauge } from "./formatMetrics.ts";
import { QUESTION_GLYPHS } from "./glyphs.ts";

const SLIDER_CELLS = 32;
const EDITOR_TITLE = "Background color";
const EDITOR_HINT = "↑/↓ channel · ←/→ adjust (shift ×16) · Enter save · Esc cancel";

const buildChannelChunks = (editor: BackgroundEditor, index: number): TextChunk[] => {
  const key = BACKGROUND_CHANNELS[index] ?? "r";
  const value = editor.color[key];
  const selected = index === editor.channel;
  const cursor = selected ? QUESTION_GLYPHS.cursor : " ";
  return [
    fg(Theme.fg.muted)("\n"),
    fg(selected ? Theme.accent.brand : Theme.fg.secondary)(
      `${cursor} ${key.toUpperCase()} ${buildGauge(value / CHANNEL_MAX, SLIDER_CELLS)} `,
    ),
    fg(selected ? Theme.fg.primary : Theme.fg.muted)(String(value).padStart(3)),
  ];
};

export const buildBackgroundChunks = (editor: BackgroundEditor): TextChunk[] => [
  bold(fg(Theme.accent.brand)(EDITOR_TITLE)),
  dim(fg(Theme.fg.muted)(`  ${EDITOR_HINT}`)),
  ...BACKGROUND_CHANNELS.flatMap((_, index) => buildChannelChunks(editor, index)),
  fg(Theme.fg.muted)(`\n  ${toBackgroundHex(editor.color)}`),
];
