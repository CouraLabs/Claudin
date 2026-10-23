import {
  DEFAULT_EFFORT,
  effortLevelSchema,
  listCheckpoints,
  type SessionState,
  THEME_NAMES,
} from "@claudin/events";
import { buildSlashCatalog } from "../input/slashCatalog.ts";
import { formatTimeAgo } from "./formatMetrics.ts";
import { SEPARATOR } from "./glyphs.ts";
import { shortenPath } from "./shortenPath.ts";
import { truncateText } from "./truncateText.ts";

export type ListRow = { name: string; description: string };

export type ListView = { title?: string; rows: ListRow[]; selected: number };

const SESSION_TITLE_LENGTH = 50;
const CHECKPOINT_TEXT_LENGTH = 60;
const SESSION_PATH_LENGTH = 30;

function buildAutocompleteView({ ui, slashCommands }: SessionState): ListView | null {
  const { autocomplete } = ui;
  if (!autocomplete || autocomplete.matches.length === 0) return null;
  const catalog = new Map(buildSlashCatalog(slashCommands).map((e) => [e.name, e.description]));
  const rows = autocomplete.matches.map((name) => ({
    name,
    description: autocomplete.kind === "slash" ? (catalog.get(name) ?? "") : "",
  }));
  return { rows, selected: autocomplete.selected };
}

function buildPickerView(state: SessionState): ListView | null {
  const { picker } = state.ui;
  if (!picker) return null;
  if (picker.kind === "model") {
    const rows = state.models.map((model) => ({
      name: `${model.value === state.model ? "● " : "  "}${model.displayName}`,
      description: model.description,
    }));
    return { title: "Select a model", rows, selected: picker.selected };
  }
  if (picker.kind === "theme") {
    const rows = THEME_NAMES.map((name) => ({
      name: `${name === state.theme ? "● " : "  "}${name}`,
      description: "",
    }));
    return { title: "Select a theme", rows, selected: picker.selected };
  }
  if (picker.kind === "effort") {
    const current = state.effort || DEFAULT_EFFORT;
    const rows = effortLevelSchema.options.map((level) => ({
      name: `${level === current ? "● " : "  "}${level}`,
      description: "",
    }));
    return { title: "Select an effort level", rows, selected: picker.selected };
  }
  if (picker.kind === "rewind") {
    const rows = listCheckpoints(state).map((entry) => ({
      name: truncateText(entry.text.replace(/\s+/g, " "), CHECKPOINT_TEXT_LENGTH),
      description: formatTimeAgo(entry.at, Date.now()),
    }));
    return { title: "Restore files to before this prompt", rows, selected: picker.selected };
  }
  const rows = state.sessionList.map((session) => ({
    name: `${truncateText(session.title, SESSION_TITLE_LENGTH)}${session.id === state.sessionId ? " (current)" : ""}`,
    description: `${shortenPath(session.cwd || "?", SESSION_PATH_LENGTH)}${SEPARATOR}${formatTimeAgo(session.updatedAt, Date.now())}`,
  }));
  const title = picker.kind === "search" ? "Matching sessions" : "Switch session";
  return { title, rows, selected: picker.selected };
}

export const buildListView = (state: SessionState): ListView | null =>
  buildPickerView(state) ?? buildAutocompleteView(state);
