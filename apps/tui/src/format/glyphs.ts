export const SEPARATOR = " ⋅ ";

export const CONTEXT_GLYPH = "⛁";

export const BRANCH_GLYPH = "⌥";

export const TOOL_GLYPH = "◆";

export const COLLAPSE_GLYPHS = {
  collapsed: "🞂",
  expanded: "🞃",
} as const;

export const APPROVAL_GLYPH = "!";

export const DONE_GLYPH = "✓";

export const ERROR_GLYPH = "✖";

export const LIMIT_GLYPH = "⏳";

const BRAILLE_BASE = 0x2800;

const brailleCodeOffset = (index: number): number =>
  (index % 8) +
  (Math.floor(index / 8) % 2) * 0x40 +
  (Math.floor(index / 16) % 8) * 8 +
  Math.floor(index / 128) * 0x80;

export const SPINNER_FRAMES = Array.from({ length: 256 }, (_, index) =>
  String.fromCodePoint(BRAILLE_BASE + brailleCodeOffset(index)),
);

export const TASK_SPINNER_FRAMES = ["∙∙∙", "●∙∙", "∙●∙", "∙∙●", "∙∙∙"] as const;

export const GAUGE_GLYPHS = ["░", "▒", "▓", "█"] as const;

export const PERMISSION_GLYPH = "⛉";

export const EFFORT_GLYPHS: Record<string, string> = {
  low: "○",
  medium: "◔",
  high: "◑",
  xhigh: "◕",
  max: "●",
};

export const TOKEN_GLYPHS = {
  input: "↑",
  output: "↓",
  cacheWrite: "⇑",
  cacheRead: "⇓",
  cacheHit: "↯",
} as const;

export const QUESTION_GLYPHS = {
  cursor: "❯",
  checked: "◉",
  unchecked: "○",
} as const;
