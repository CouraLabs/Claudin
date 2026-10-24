const FALLBACK_BASE = "ws://127.0.0.1";

export const readRequestParam = (request: { url?: string }, name: string): string | undefined =>
  new URL(request.url ?? "/", FALLBACK_BASE).searchParams.get(name) ?? undefined;
