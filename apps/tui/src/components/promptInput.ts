import {
  BoxRenderable,
  type CliRenderer,
  type KeyBinding,
  TextareaRenderable,
  TextRenderable,
} from "@opentui/core";
import { Theme } from "../theme/colors.ts";

const MAX_INPUT_LINES = 8;
const BUSY_TITLE = " Ctrl+Q (queue) Ctrl+W (steer) ";
const PLACEHOLDER = "Type your prompt, /slash command, or @file reference...";

const KEY_BINDINGS: KeyBinding[] = [
  { name: "return", action: "submit" },
  { name: "kpenter", action: "submit" },
  { name: "return", shift: true, action: "newline" },
  { name: "return", meta: true, action: "newline" },
  { name: "linefeed", action: "newline" },
];

export type PromptInputHandlers = {
  onSubmit: (text: string) => void;
  onChange: (text: string, cursor: number) => void;
};

export class PromptInput {
  readonly renderable: BoxRenderable;
  readonly textarea: TextareaRenderable;
  readonly chevron: TextRenderable;
  focused = false;

  constructor(renderer: CliRenderer, handlers: PromptInputHandlers) {
    this.renderable = new BoxRenderable(renderer, {
      border: ["top", "bottom"],
      borderStyle: "rounded",
      bottomTitleAlignment: "right",
      flexDirection: "row",
      height: 3,
      flexShrink: 0,
      paddingLeft: 1,
    });
    this.textarea = new TextareaRenderable(renderer, {
      flexGrow: 1,
      height: 1,
      placeholder: PLACEHOLDER,
      wrapMode: "word",
      keyBindings: KEY_BINDINGS,
      onSubmit: () => handlers.onSubmit(this.text),
      onContentChange: () => {
        this.fitHeight();
        handlers.onChange(this.text, this.textarea.cursorOffset);
      },
    });
    this.chevron = new TextRenderable(renderer, { content: "❯ ", width: 2 });
    this.renderable.add(this.chevron);
    this.renderable.add(this.textarea);
    this.applyColors();
  }

  get text(): string {
    return this.textarea.plainText;
  }

  get cursor(): number {
    return this.textarea.cursorOffset;
  }

  replaceText(text: string, cursor: number): void {
    this.textarea.setText(text);
    this.textarea.cursorOffset = cursor;
  }

  clear(): void {
    this.textarea.setText("");
  }

  setFocused(focused: boolean): void {
    if (focused === this.focused) return;
    this.focused = focused;
    if (focused) this.textarea.focus();
    else this.textarea.blur();
  }

  setBusy(busy: boolean): void {
    const title = busy ? BUSY_TITLE : undefined;
    if (this.renderable.bottomTitle !== title) this.renderable.bottomTitle = title;
  }

  setBorderColor(color: string): void {
    this.renderable.borderColor = color;
  }

  applyColors(): void {
    this.renderable.titleColor = Theme.fg.primary;
    this.chevron.fg = Theme.accent.brand;
    this.textarea.placeholderColor = Theme.fg.muted;
    this.textarea.textColor = Theme.fg.primary;
    this.textarea.focusedTextColor = Theme.fg.primary;
    this.textarea.backgroundColor = Theme.bg.default;
    this.textarea.focusedBackgroundColor = Theme.bg.default;
  }

  fitHeight(): void {
    const wanted = Math.max(this.textarea.lineCount, this.textarea.virtualLineCount, 1);
    const lines = Math.min(wanted, MAX_INPUT_LINES);
    this.textarea.height = lines;
    this.renderable.height = lines + 2;
  }
}
