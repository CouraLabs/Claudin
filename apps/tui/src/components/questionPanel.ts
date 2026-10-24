import { OTHER_LABEL, type QuestionDraft, readCurrentQuestion } from "@kraude-kode/events";
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

const buildRowChunks = (
  draft: QuestionDraft,
  multiSelect: boolean,
  { label, description, custom }: OptionRow,
  index: number,
): TextChunk[] => {
  const focused = index === draft.cursor;
  const checked = custom ? draft.custom.trim() !== "" : draft.picks.includes(label);
  const marker = multiSelect ? (checked ? QUESTION_GLYPHS.checked : QUESTION_GLYPHS.unchecked) : "";
  const prefix = [focused ? QUESTION_GLYPHS.cursor : " ", marker].filter(Boolean).join(" ");
  const head = fg(focused ? Theme.accent.brand : Theme.fg.primary)(`${prefix} ${label}`);
  if (!custom) return [head, fg(Theme.fg.muted)(` ${description}`)];
  const typed = draft.custom
    ? [fg(Theme.fg.primary)(draft.custom)]
    : focused
      ? []
      : [fg(Theme.fg.muted)(CUSTOM_PLACEHOLDER)];
  return [
    head,
    fg(Theme.fg.muted)(": "),
    ...typed,
    ...(focused ? [fg(Theme.accent.brand)(TEXT_CURSOR)] : []),
  ];
};

const listRows = (draft: QuestionDraft): OptionRow[] => {
  const current = readCurrentQuestion(draft);
  return current ? [...current.options, { label: OTHER_LABEL, description: "", custom: true }] : [];
};

export class QuestionPanel {
  readonly renderable: BoxRenderable;
  readonly text: TextRenderable;
  readonly rows: BoxRenderable;
  readonly hint: TextRenderable;
  private rowViews: TextRenderable[] = [];

  constructor(
    private renderer: CliRenderer,
    private onSelectRow: (index: number) => void,
  ) {
    this.renderable = new BoxRenderable(renderer, {
      flexDirection: "column",
      marginTop: 1,
      flexShrink: 0,
    });
    this.text = new TextRenderable(renderer, { content: "" });
    this.rows = new BoxRenderable(renderer, { flexDirection: "column" });
    this.hint = new TextRenderable(renderer, {
      content: new StyledText([dim(fg(Theme.fg.muted)(QUESTION_HINT))]),
    });
    this.renderable.add(this.text);
    this.renderable.add(this.rows);
    this.renderable.add(this.hint);
  }

  private readRowView(index: number): TextRenderable {
    const existing = this.rowViews[index];
    if (existing) return existing;
    const created = new TextRenderable(this.renderer, {
      content: "",
      selectable: false,
      onMouseDown: () => this.onSelectRow(index),
    });
    this.rowViews.push(created);
    this.rows.add(created);
    return created;
  }

  update(draft: QuestionDraft): void {
    const current = readCurrentQuestion(draft);
    if (!current) return;
    const progress =
      draft.questions.length > 1 ? ` (${draft.index + 1}/${draft.questions.length})` : "";
    this.text.content = new StyledText([
      bold(fg(Theme.status.warning)(`>>> ${current.header}${progress}: `)),
      bold(fg(Theme.fg.primary)(current.question)),
    ]);
    const rows = listRows(draft);
    rows.forEach((row, index) => {
      const view = this.readRowView(index);
      view.visible = true;
      view.content = new StyledText(
        buildRowChunks(draft, current.multiSelect === true, row, index),
      );
    });
    this.rowViews.slice(rows.length).forEach((view) => {
      view.visible = false;
    });
  }
}
