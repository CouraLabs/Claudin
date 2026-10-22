import type { ModelInfo, SlashCommand } from "@anthropic-ai/claude-agent-sdk";
import { DEFAULT_PERMISSION_MODE } from "../requests/agentRequestEvents.ts";
import type { QuestionDraft } from "../models/askedQuestion.ts";
import { type BackgroundColor, TRANSPARENT_BACKGROUND } from "../models/backgroundColor.ts";
import type { PromptContent } from "../models/sdkValue.ts";
import type { SessionSummary } from "./sessionSummary.ts";
import { DEFAULT_THEME_NAME, type ThemeName } from "../models/themeNames.ts";
import type {
  AgentStatus,
  LastRun,
  RateLimits,
  TokenUsage,
  TranscriptEntry,
} from "./transcriptTypes.ts";
import type { Autocomplete, BackgroundEditor, FocusTarget, Picker } from "../requests/uiEvents.ts";
import type { GitStats } from "../requests/workspaceEvents.ts";

export const DEFAULT_CONTEXT_WINDOW = 200_000;

export type UiState = {
  focus: FocusTarget;
  autocomplete: Autocomplete | null;
  picker: Picker | null;
  backgroundEditor: BackgroundEditor | null;
  question: QuestionDraft | null;
};

export type SessionState = {
  sessionId: string;
  prompts: PromptContent[];
  agentSessionId?: string;
  status: AgentStatus;
  model: string;
  permissionMode: string;
  effort: string;
  theme: ThemeName;
  background: BackgroundColor;
  cwd: string;
  gitBranch: string;
  gitStats: GitStats;
  tokens: TokenUsage;
  costUsd: number;
  rateLimits: RateLimits;
  slashCommands: SlashCommand[];
  models: ModelInfo[];
  sessionList: SessionSummary[];
  queuedTurns: number;
  transcript: TranscriptEntry[];
  entryCounter: number;
  streamingMessageId?: string;
  thinkingStartedAt?: number;
  turnStartedAt?: number;
  lastRun?: LastRun;
  now: number;
  ui: UiState;
};

export const createSessionState = (sessionId: string): SessionState => ({
  sessionId,
  prompts: [],
  status: "idle",
  model: "",
  permissionMode: DEFAULT_PERMISSION_MODE,
  effort: "",
  theme: DEFAULT_THEME_NAME,
  background: TRANSPARENT_BACKGROUND,
  cwd: "",
  gitBranch: "",
  gitStats: { additions: 0, deletions: 0 },
  tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, maxContext: DEFAULT_CONTEXT_WINDOW },
  costUsd: 0,
  rateLimits: {},
  slashCommands: [],
  models: [],
  sessionList: [],
  queuedTurns: 0,
  transcript: [],
  entryCounter: 0,
  now: Date.now(),
  ui: { focus: "input", autocomplete: null, picker: null, backgroundEditor: null, question: null },
});
