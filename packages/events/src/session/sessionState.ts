import type { ModelInfo, SlashCommand } from "@anthropic-ai/claude-agent-sdk";
import type { QuestionDraft } from "../models/askedQuestion.ts";
import { type BackgroundColor, TRANSPARENT_BACKGROUND } from "../models/backgroundColor.ts";
import type { PromptContent } from "../models/sdkValue.ts";
import { DEFAULT_THEME_NAME, type ThemeName } from "../models/themeNames.ts";
import { DEFAULT_PERMISSION_MODE } from "../requests/agentRequestEvents.ts";
import type {
  Autocomplete,
  BackgroundEditor,
  DiffViewer,
  Picker,
  PromptHistory,
  Toast,
} from "../requests/uiEvents.ts";
import type { GitStats } from "../requests/workspaceEvents.ts";
import type { RunningTask } from "./runningTask.ts";
import type { SessionSummary } from "./sessionSummary.ts";
import type {
  AgentStatus,
  LastRun,
  RateLimits,
  RateLimitWait,
  TokenUsage,
  TranscriptEntry,
} from "./transcriptTypes.ts";

export const DEFAULT_CONTEXT_WINDOW = 200_000;

export type UiState = {
  autocomplete: Autocomplete | null;
  picker: Picker | null;
  backgroundEditor: BackgroundEditor | null;
  question: QuestionDraft | null;
  history: PromptHistory | null;
  diffViewer: DiffViewer | null;
  toast: Toast | null;
};

export type SessionState = {
  sessionId: string;
  prompts: PromptContent[];
  promptHistory: string[];
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
  rateLimitWait?: RateLimitWait;
  slashCommands: SlashCommand[];
  models: ModelInfo[];
  sessionList: SessionSummary[];
  queuedTurns: number;
  queuedPrompts: PromptContent[];
  tasks: RunningTask[];
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
  promptHistory: [],
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
  queuedPrompts: [],
  tasks: [],
  transcript: [],
  entryCounter: 0,
  now: Date.now(),
  ui: {
    autocomplete: null,
    picker: null,
    backgroundEditor: null,
    question: null,
    history: null,
    diffViewer: null,
    toast: null,
  },
});
