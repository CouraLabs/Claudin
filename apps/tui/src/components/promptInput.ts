import {
  BoxRenderable,
  type CliRenderer,
  type KeyBinding,
  type PasteEvent,
  SyntaxStyle,
  TextareaRenderable,
  TextRenderable,
} from "@opentui/core";
import { PasteAttachments, type PromptDraft } from "../prompt/pasteAttachments.ts";
import { planPaste } from "../prompt/planPaste.ts";
import { Theme } from "../theme/colors.ts";

const MAX_INPUT_LINES = 8;
const BUSY_TITLE = " Ctrl+Q (queue) Ctrl+W (steer) ";
const ATTACHMENT_STYLE = "attachment";
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
  readonly attachments = new PasteAttachments();
  private readonly attachmentStyle: SyntaxStyle;
  private attachmentStyleId = 0;
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
    this.attachmentStyle = SyntaxStyle.create(renderer.nativeScene);
    this.textarea = new TextareaRenderable(renderer, {
      flexGrow: 1,
      height: 1,
      placeholder: PLACEHOLDER,
      wrapMode: "word",
      keyBindings: KEY_BINDINGS,
      syntaxStyle: this.attachmentStyle,
      onPaste: (event) => this.insertPlaceholder(event),
      onSubmit: () => handlers.onSubmit(this.text),
      onContentChange: () => {
        this.markAttachments();
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

  compose(): PromptDraft {
    return this.attachments.compose(this.text);
  }

  insertPlaceholder(event: PasteEvent): void {
    const placeholder = planPaste(event, this.attachments);
    if (placeholder === undefined) return;
    event.preventDefault();
    this.textarea.insertText(placeholder);
  }

  clear(): void {
    this.textarea.setText("");
    this.attachments.reset();
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
    this.attachmentStyleId = this.attachmentStyle.registerStyle(ATTACHMENT_STYLE, {
      fg: Theme.accent.highlight,
      bold: true,
    });
    this.markAttachments();
  }

  private markAttachments(): void {
    const { extmarks } = this.textarea;
    extmarks.clear();
    const text = this.text;
    for (const placeholder of this.attachments.placeholders()) {
      for (let at = text.indexOf(placeholder); at >= 0; at = text.indexOf(placeholder, at + 1)) {
        extmarks.create({
          start: at,
          end: at + placeholder.length,
          virtual: true,
          styleId: this.attachmentStyleId,
        });
      }
    }
  }

  fitHeight(): void {
    const wanted = Math.max(this.textarea.lineCount, this.textarea.virtualLineCount, 1);
    const lines = Math.min(wanted, MAX_INPUT_LINES);
    this.textarea.height = lines;
    this.renderable.height = lines + 2;
  }
}
