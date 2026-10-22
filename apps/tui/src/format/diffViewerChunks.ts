import type { DiffViewer, FileDiff } from "@claudin/events";
import { bold, dim, fg, type TextChunk } from "@opentui/core";
import { Theme } from "../theme/colors.ts";
import { SEPARATOR } from "./glyphs.ts";

const VIEWER_TITLE = "Session diffs";
const VIEWER_HINT = "←/→ file · ↑/↓ PgUp/PgDn scroll · Esc close";

const buildFileChunks = (file: FileDiff, selected: boolean): TextChunk[] => [
  selected ? bold(fg(Theme.fg.primary)(`❯ ${file.path}`)) : fg(Theme.fg.secondary)(file.path),
  fg(Theme.status.success)(` +${file.additions}`),
  fg(Theme.status.danger)(` -${file.deletions}`),
];

export const buildDiffViewerChunks = ({ files, selected }: DiffViewer): TextChunk[] => [
  bold(fg(Theme.accent.brand)(VIEWER_TITLE)),
  fg(Theme.fg.muted)(` (${selected + 1}/${files.length})`),
  dim(fg(Theme.fg.muted)(`  ${VIEWER_HINT}`)),
  fg(Theme.fg.muted)("\n"),
  ...files.flatMap((file, index) => [
    ...(index > 0 ? [fg(Theme.fg.muted)(SEPARATOR)] : []),
    ...buildFileChunks(file, index === selected),
  ]),
];
