import open from "open";

export const openBrowser = (url: string): Promise<unknown> => open(url).catch(() => undefined);
