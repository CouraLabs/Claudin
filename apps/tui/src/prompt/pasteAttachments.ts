import type { ImageBlock } from "./imageBlock.ts";

export type PromptDraft = { text: string; images: ImageBlock[] };

export class PasteAttachments {
  private readonly replacements = new Map<string, string>();
  private readonly images = new Map<string, ImageBlock>();
  private counter = 0;

  addText(text: string): string {
    const lines = text.split("\n").length;
    return this.remember(`Pasted text #${this.next()} +${lines} lines`, text);
  }

  addFile(path: string): string {
    const name = path.split("/").at(-1) ?? path;
    return this.remember(`File #${this.next()} ${name}`, path);
  }

  addImage(image: ImageBlock): string {
    const placeholder = `[Image #${this.next()}]`;
    this.images.set(placeholder, image);
    return placeholder;
  }

  compose(text: string): PromptDraft {
    let expanded = text;
    for (const [placeholder, value] of this.replacements) {
      expanded = expanded.replaceAll(placeholder, () => value);
    }
    const images = [...this.images]
      .map(([placeholder, image]) => ({ at: text.indexOf(placeholder), image }))
      .filter(({ at }) => at >= 0)
      .sort((left, right) => left.at - right.at)
      .map(({ image }) => image);
    return { text: expanded, images };
  }

  placeholders(): string[] {
    return [...this.replacements.keys(), ...this.images.keys()];
  }

  reset(): void {
    this.replacements.clear();
    this.images.clear();
    this.counter = 0;
  }

  private remember(label: string, value: string): string {
    const placeholder = `[${label}]`;
    this.replacements.set(placeholder, value);
    return placeholder;
  }

  private next(): number {
    this.counter += 1;
    return this.counter;
  }
}
