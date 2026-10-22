import { z } from "zod";

export const askedQuestionSchema = z.object({
  question: z.string(),
  header: z.string(),
  multiSelect: z.boolean().optional(),
  options: z.array(z.object({ label: z.string(), description: z.string() })).min(1),
});

export const askedQuestionsSchema = z.array(askedQuestionSchema).min(1);

export type AskedQuestion = z.infer<typeof askedQuestionSchema>;

export type QuestionDraft = {
  toolUseId: string;
  questions: AskedQuestion[];
  index: number;
  cursor: number;
  picks: string[];
  custom: string;
  answers: Record<string, string>;
};
