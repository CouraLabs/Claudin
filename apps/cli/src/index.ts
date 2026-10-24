#!/usr/bin/env bun
import {
  createAccessToken,
  createDaemonContext,
  createRunId,
  DaemonClient,
  DaemonHub,
  ReplayClient,
  startDaemon,
} from "@kraude-kode/daemon";
import { startTui } from "@kraude-kode/tui";
import { Command } from "commander";
import { removeDaemonDiscovery, writeDaemonDiscovery } from "./daemon/discovery.ts";
import { openDaemonClient } from "./daemon/spawn.ts";

const DEFAULT_PORT = "7777";

const runId = createRunId();

const program = new Command().name("kraude").enablePositionalOptions();

type PortOptions = { port: string; session?: string; token?: string; auto?: boolean };
type Renderer = Awaited<ReturnType<typeof startTui>>;

const printResumeHint = (sessionId: string): void => {
  if (!sessionId) return;
  process.once("exit", () =>
    process.stdout.write(`\nSession: ${sessionId}\nResume with: kraude --session ${sessionId}\n`),
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
    const client = await openDaemonClient({
      entryPath: import.meta.path,
      port: Number(opts.port),
      runId,
      cwd: process.cwd(),
    }).catch((error: Error) => program.error(error.message));
    const renderer = await startTui(client, {
      resumeSessionId: opts.session,
      onExit: printResumeHint,
    });
    client.onDisconnect(() => renderer.destroy());
    exitOnDestroy(renderer);
  });

program
  .command("daemon")
  .description("Run the daemon without a UI so terminals can attach to it")
  .option("-p, --port <port>", "daemon port", DEFAULT_PORT)
  .option("-s, --session <id>", "serve a previous session")
  .option("-t, --token <token>", "access token for attaching clients")
  .option("--auto", "mark the daemon as client-spawned so idle daemons get restarted", false)
  .action(async (opts: PortOptions) => {
    const port = Number(opts.port);
    const token = opts.token ?? createAccessToken();
    const hub = new DaemonHub(() => createDaemonContext());
    if (opts.session) hub.setRoot(await openContext(opts.session));
    const server = await startDaemon(port, token, hub).catch((error: Error) =>
      program.error(`Port ${port} is already in use — is a daemon already running? ${error}`),
    );
    await writeDaemonDiscovery({ port, token, pid: process.pid, auto: Boolean(opts.auto) });
    const stop = async () => {
      await removeDaemonDiscovery(port, process.pid);
      hub.closeAllAgents();
      server.close();
      process.exit(0);
    };
    process.on("SIGINT", () => void stop());
    process.on("SIGTERM", () => void stop());
    process.stdout.write(
      `Daemon on ${daemonUrl(opts.port)} (run ${runId})\nAttach with: kraude attach -p ${opts.port} --token ${token}\n`,
    );
  });

program
  .command("attach")
  .description("Attach another terminal to a running daemon's live session")
  .option("-p, --port <port>", "daemon port", DEFAULT_PORT)
  .option("-t, --token <token>", "access token printed by the daemon (or KRAUDE_TOKEN)")
  .action(async (opts: PortOptions) => {
    const token =
      opts.token ??
      process.env.KRAUDE_TOKEN ??
      program.error("An access token is required: pass --token or set KRAUDE_TOKEN");
    const client = await DaemonClient.connect(daemonUrl(opts.port), {
      token,
      runId,
      mode: "attach",
    }).catch((error: Error) => program.error(error.message));
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
