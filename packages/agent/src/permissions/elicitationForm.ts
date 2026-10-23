import type { AskedQuestion } from "@claudin/events";
import { sanitizeText } from "./sanitizeText.ts";

type Choice = { value: string; label: string };

type FieldKind = "text" | "number" | "boolean" | "choice" | "multi";

type FormField = { key: string; question: string; kind: FieldKind; choices: Choice[] };

export type ElicitationForm = { questions: AskedQuestion[]; fields: FormField[] };

type Schema = Record<string, unknown>;

export type ElicitationContent = Record<string, string | number | boolean | string[]>;

export const SKIP_LABEL = "Skip";
export const ACCEPT_LABEL = "Accept";
export const DECLINE_LABEL = "Decline";
export const YES_LABEL = "Yes";
export const NO_LABEL = "No";

const isSchema = (value: unknown): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const toChoice = (entry: unknown): Choice | undefined => {
  if (typeof entry === "string") return { value: entry, label: sanitizeText(entry) };
  if (!isSchema(entry) || typeof entry.const !== "string") return undefined;
  const label = typeof entry.title === "string" ? entry.title : entry.const;
  return { value: entry.const, label: sanitizeText(label) };
};

const readChoices = (field: Schema): Choice[] => {
  const source = isSchema(field.items) ? field.items : field;
  const entries = [...readList(source.oneOf), ...readList(source.anyOf), ...readList(source.enum)];
  return entries.flatMap((entry) => toChoice(entry) ?? []);
};

const readKind = (field: Schema, choices: Choice[]): FieldKind => {
  if (field.type === "array") return "multi";
  if (choices.length > 0) return "choice";
  if (field.type === "boolean") return "boolean";
  return field.type === "number" || field.type === "integer" ? "number" : "text";
};

const readOptions = (kind: FieldKind, choices: Choice[]): AskedQuestion["options"] => {
  const labelled = (labels: string[]) => labels.map((label) => ({ label, description: "" }));
  if (kind === "boolean") return labelled([YES_LABEL, NO_LABEL]);
  return labelled(choices.length > 0 ? choices.map(({ label }) => label) : [SKIP_LABEL]);
};

const buildQuestionText = (key: string, field: Schema, message: string): string => {
  const title = sanitizeText(typeof field.title === "string" ? field.title : key);
  const description =
    typeof field.description === "string" ? ` (${sanitizeText(field.description)})` : "";
  return `${message}${title}${description}`;
};

const buildConfirmForm = (header: string, message: string): ElicitationForm => ({
  fields: [],
  questions: [
    {
      header,
      question: message,
      options: [
        { label: ACCEPT_LABEL, description: "" },
        { label: DECLINE_LABEL, description: "" },
      ],
    },
  ],
});

export function buildElicitationForm(
  serverName: string,
  message: string,
  requestedSchema: Schema | undefined,
): ElicitationForm {
  const header = sanitizeText(serverName);
  const properties = isSchema(requestedSchema?.properties) ? requestedSchema.properties : {};
  const entries = Object.entries(properties).filter((entry): entry is [string, Schema] =>
    isSchema(entry[1]),
  );
  if (entries.length === 0) return buildConfirmForm(header, sanitizeText(message));
  const fields: FormField[] = [];
  const questions: AskedQuestion[] = [];
  for (const [key, field] of entries) {
    const choices = readChoices(field);
    const kind = readKind(field, choices);
    const intro = fields.length === 0 ? `${sanitizeText(message)} — ` : "";
    const question = buildQuestionText(key, field, intro);
    fields.push({ key, question, kind, choices });
    questions.push({
      header,
      question,
      multiSelect: kind === "multi",
      options: readOptions(kind, choices),
    });
  }
  return { fields, questions };
}

const readChoiceValue = (choices: Choice[], label: string): string =>
  choices.find((choice) => choice.label === label)?.value ?? label;

const readFieldValue = (
  { kind, choices }: FormField,
  answer: string,
): ElicitationContent[string] | undefined => {
  if (kind === "boolean") return answer === YES_LABEL;
  if (kind === "number") return Number.isFinite(Number(answer)) ? Number(answer) : undefined;
  if (kind === "choice") return readChoiceValue(choices, answer);
  if (kind === "multi") return answer.split(", ").map((label) => readChoiceValue(choices, label));
  return answer;
};

export function buildElicitationContent(
  form: ElicitationForm,
  answers: Record<string, string>,
): ElicitationContent {
  const content: ElicitationContent = {};
  for (const field of form.fields) {
    const answer = answers[field.question]?.trim();
    if (!answer || answer === SKIP_LABEL) continue;
    const value = readFieldValue(field, answer);
    if (value !== undefined) content[field.key] = value;
  }
  return content;
}

export const isConfirmAccepted = (
  form: ElicitationForm,
  answers: Record<string, string>,
): boolean => form.fields.length > 0 || Object.values(answers).includes(ACCEPT_LABEL);
