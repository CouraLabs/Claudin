import { Theme } from "../theme/colors.ts";

export const readEffortColor = (effort: string): string =>
  ({
    low: Theme.fg.muted,
    medium: Theme.fg.primary,
    high: Theme.status.warning,
    xhigh: Theme.status.info,
    max: Theme.status.danger,
  })[effort] ?? Theme.fg.secondary;

export const readPermissionColor = (mode: string): string =>
  ({
    acceptEdits: Theme.status.success,
    auto: Theme.accent.highlight,
    dontAsk: Theme.status.warning,
    bypassPermissions: Theme.status.danger,
  })[mode] ?? Theme.fg.secondary;

export const readUsageColor = (ratio: number): string => {
  const colors = [
    Theme.fg.muted,
    Theme.fg.primary,
    Theme.status.info,
    Theme.status.warning,
    Theme.status.danger,
  ];
  return colors[Math.min(Math.floor(ratio * colors.length), colors.length - 1)] ?? Theme.fg.muted;
};
