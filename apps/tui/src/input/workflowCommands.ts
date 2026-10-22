import { listEditedFiles } from "@claudin/events";
import type { AppStore } from "../store/appStore.ts";
import { guardIdle } from "./agentBusy.ts";

export type SlashCommand = {
  description: string;
  run: (store: AppStore, argument: string) => void;
};

const postNotice = (store: AppStore, text: string): void =>
  store.emit({ type: "ui.notice.posted", text });

export const WORKFLOW_COMMANDS: Record<string, SlashCommand> = {
  "/fork": {
    description: "Branch this conversation into a new session",
    run(store) {
      if (guardIdle(store, "forking")) store.request({ type: "session.fork.requested" });
    },
  },
  "/rewind": {
    description: "Restore edited files to before an earlier prompt",
    run(store) {
      if (guardIdle(store, "rewinding")) store.emit({ type: "ui.rewind.picker.opened" });
    },
  },
  "/view-diffs": {
    description: "Review the diffs of files this session edited",
    run(store) {
      const paths = listEditedFiles(store.state);
      if (paths.length === 0) return postNotice(store, "This session has not edited any files");
      store.request({ type: "workspace.diff.requested", paths });
    },
  },
  "/export": {
    description: "Export the transcript as markdown (/export [path])",
    run(store, path) {
      store.request({ type: "session.export.requested", path: path || undefined });
    },
  },
  "/search": {
    description: "Search past sessions (/search <text>)",
    run(store, query) {
      if (!query) return postNotice(store, "Usage: /search <text>");
      store.request({ type: "session.search.requested", query });
    },
  },
};
