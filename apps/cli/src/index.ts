#!/usr/bin/env bun
import {
  createAccessToken,
  createDaemonContext,
  createRunId,
  DaemonClient,
  ReplayClient,
  startDaemon,
} from "@claudin/daemon";
import { startTui } from "@claudin/tui";
import { Command } from "commander";

const DEFAULT_PORT = "7777";

const runId = createRunId();

const program = new Command().name("claudin").enablePositionalOptions();

type PortOptions = { port: string; session?: string; token?: string };
type Renderer = Awaited<ReturnType<typeof startTui>>;

const printResumeHint = (sessionId: string): void => {
  if (!sessionId) return;
  process.once("exit", () =>
    process.stdout.write(`\nSession: ${sessionId}\nResume with: claudin --session ${sessionId}\n`),
  );
};

const exitOnDestroy = (renderer: Renderer): void => {
  renderer.on("destroy", () => process.exit(0));
};

const openContext = (sessionId?: string) =>
  createDaemonContext(undefined, sessionId).catch((error: Error) => program.error(error.message));

const daemonUrl = (port: string): string => `ws://127.0.0.1:${Number(port)}`;

program
  .option("-p, --port <port>", "daemon port", DEFAULT_PORT)
  .option("-s, --session <id>", "resume a previous session")
  .action(async (opts: PortOptions) => {
    const token = createAccessToken();
    const server = await startDaemon(Number(opts.port), token, await openContext(opts.session));
    const client = await DaemonClient.connect(daemonUrl(opts.port), { token, runId });
    const renderer = await startTui(client, {
      resumeSessionId: opts.session,
      onExit: printResumeHint,
    });
    renderer.on("destroy", () => {
      for (const socket of server.clients) socket.terminate();
      server.close(() => process.exit(0));
    });
  });

program
  .command("daemon")
  .description("Run the daemon without a UI so terminals can attach to it")
  .option("-p, --port <port>", "daemon port", DEFAULT_PORT)
  .option("-s, --session <id>", "serve a previous session")
  .action(async (opts: PortOptions) => {
    const token = createAccessToken();
    await startDaemon(Number(opts.port), token, await openContext(opts.session));
    process.stdout.write(
      `Daemon on ${daemonUrl(opts.port)} (run ${runId})\nAttach with: claudin attach -p ${opts.port} --token ${token}\n`,
    );
  });

program
  .command("attach")
  .description("Attach another terminal to a running daemon's live session")
  .option("-p, --port <port>", "daemon port", DEFAULT_PORT)
  .option("-t, --token <token>", "access token printed by the daemon (or CLAUDIN_TOKEN)")
  .action(async (opts: PortOptions) => {
    const token =
      opts.token ??
      process.env.CLAUDIN_TOKEN ??
      program.error("An access token is required: pass --token or set CLAUDIN_TOKEN");
    const client = await DaemonClient.connect(daemonUrl(opts.port), { token, runId }).catch(
      (error: Error) => program.error(error.message),
    );
    const renderer = await startTui(client, { attach: true, onExit: printResumeHint });
    client.onDisconnect(() => renderer.destroy());
    exitOnDestroy(renderer);
  });

program
  .command("replay <sessionId>")
  .description("Replay a stored session in the UI, read-only")
  .option("--speed <factor>", "playback speed multiplier", "1")
  .action(async (sessionId: string, opts: { speed: string }) => {
    const speed = Number(opts.speed);
    if (!(speed > 0)) program.error("--speed must be a positive number");
    const client = await ReplayClient.load(sessionId, speed).catch((error: Error) =>
      program.error(error.message),
    );
    exitOnDestroy(await startTui(client, { attach: true }));
  });

await program.parseAsync();
