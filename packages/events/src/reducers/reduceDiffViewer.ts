import type { FileDiff } from "../models/fileDiff.ts";
import type { SessionState } from "../session/sessionState.ts";
import { appendNotice } from "./appendEntry.ts";
import { wrapIndex } from "./wrapIndex.ts";

const NO_DIFFS_NOTICE = "No changes in the files this session edited";

export function openDiffViewer(state: SessionState, files: FileDiff[]): SessionState {
  if (files.length === 0) return appendNotice(state, NO_DIFFS_NOTICE);
  return { ...state, ui: { ...state.ui, diffViewer: { files, selected: 0 } } };
}

export function moveDiffViewer(state: SessionState, delta: 1 | -1): SessionState {
  const viewer = state.ui.diffViewer;
  if (!viewer) return state;
  const selected = wrapIndex(viewer.selected + delta, viewer.files.length);
  return { ...state, ui: { ...state.ui, diffViewer: { ...viewer, selected } } };
}

export const closeDiffViewer = (state: SessionState): SessionState => ({
  ...state,
  ui: { ...state.ui, diffViewer: null },
});
