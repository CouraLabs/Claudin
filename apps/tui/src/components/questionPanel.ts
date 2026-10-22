import { OTHER_LABEL, type QuestionDraft, readCurrentQuestion } from "@claudin/events";
import {
  BoxRenderable,
  bold,
  type CliRenderer,
  dim,
  fg,
  StyledText,
  type TextChunk,
  TextRenderable,
} from "@opentui/core";
import { QUESTION_GLYPHS } from "../format/glyphs.ts";
import { Theme } from "../theme/colors.ts";

const QUESTION_HINT = "↑/↓ select · Space toggle · Enter confirm · Esc dismiss";

const CUSTOM_PLACEHOLDER = "type your own answer";
const TEXT_CURSOR = "▏";

type OptionRow = { label: string; description: string; custom?: boolean };

const buildRowChunks = (draft: QuestionDraft): TextChunk[] => {
  const current = readCurrentQuestion(draft);
  if (!current) return [];
  const rows: OptionRow[] = [
    ...current.options,
    { label: OTHER_LABEL, description: "", custom: true },
  ];
  return rows.flatMap(({ label, description, custom }, index) => {
    const focused = index === draft.cursor;
    const checked = custom ? draft.custom.trim() !== "" : draft.picks.includes(label);
    const marker = current.multiSelect
      ? checked
        ? QUESTION_GLYPHS.checked
        : QUESTION_GLYPHS.unchecked
      : "";
    const prefix = [focused ? QUESTION_GLYPHS.cursor : " ", marker].filter(Boolean).join(" ");
    const head = fg(focused ? Theme.accent.brand : Theme.fg.primary)(`\n${prefix} ${label}`);
    if (!custom) return [head, fg(Theme.fg.muted)(` ${description}`)];
    const typed = draft.custom
      ? fg(Theme.fg.primary)(draft.custom)
      : fg(Theme.fg.muted)(CUSTOM_PLACEHOLDER);
    return [
      head,
      fg(Theme.fg.muted)(": "),
      typed,
      ...(focused ? [fg(Theme.accent.brand)(TEXT_CURSOR)] : []),
    ];
  });
};

export class QuestionPanel {
  readonly renderable: BoxRenderable;
  readonly text: TextRenderable;

  constructor(renderer: CliRenderer) {
    this.renderable = new BoxRenderable(renderer, {
      flexDirection: "column",
      marginTop: 1,
      flexShrink: 0,
    });
    this.text = new TextRenderable(renderer, { content: "" });
    this.renderable.add(this.text);
  }

  update(draft: QuestionDraft): void {
    const current = readCurrentQuestion(draft);
    if (!current) return;
    const progress =
      draft.questions.length > 1 ? ` (${draft.index + 1}/${draft.questions.length})` : "";
    this.text.content = new StyledText([
      bold(fg(Theme.status.warning)(`>>> ${current.header}${progress}: `)),
      bold(fg(Theme.fg.primary)(current.question)),
      ...buildRowChunks(draft),
      dim(fg(Theme.fg.muted)(`\n${QUESTION_HINT}`)),
    ]);
  }
}
