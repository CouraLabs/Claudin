import type { AskedQuestion, QuestionDraft } from "./askedQuestion.ts";

export const OTHER_LABEL = "Other";

export const readCurrentQuestion = (draft: QuestionDraft): AskedQuestion | undefined =>
  draft.questions[draft.index];

export const isLastQuestion = (draft: QuestionDraft): boolean =>
  draft.index >= draft.questions.length - 1;

export const isCustomRow = (draft: QuestionDraft): boolean => {
  const current = readCurrentQuestion(draft);
  return current !== undefined && draft.cursor === current.options.length;
};

export function buildDraftAnswer(draft: QuestionDraft): string {
  const current = readCurrentQuestion(draft);
  if (!current) return "";
  const custom = draft.custom.trim();
  if (!current.multiSelect)
    return isCustomRow(draft) ? custom : (current.options[draft.cursor]?.label ?? "");
  const labels = current.options
    .map((option) => option.label)
    .filter((label) => draft.picks.includes(label));
  const chosen = custom ? [...labels, custom] : labels;
  return chosen.length > 0 ? chosen.join(", ") : (current.options[draft.cursor]?.label ?? "");
}
