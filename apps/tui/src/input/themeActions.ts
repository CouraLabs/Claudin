import type { ThemeName } from "@kraude-kode/events";
import type { AppStore } from "../store/appStore.ts";

export const saveTheme = (store: AppStore, theme: ThemeName): void =>
  store.request({ type: "options.theme.save.requested", theme });
