#!/usr/bin/env bun
import { createDaemonContext, DaemonClient, startDaemon } from "@claudin/daemon";
import { startTui } from "@claudin/tui";
import { Command } from "commander";

const program = new Command().name("claudin");

const printResumeHint = (sessionId: string): void => {
  if (!sessionId) return;
  process.once("exit", () =>
    process.stdout.write(`\nSession: ${sessionId}\nResume with: claudin --session ${sessionId}\n`),
  );
};

program
  .option("-p, --port <port>", "daemon port", "7777")
  .option("-s, --session <id>", "resume a previous session")
  .action(async (opts: { port: string; session?: string }) => {
    const port = Number(opts.port);
    const context = await createDaemonContext(undefined, opts.session).catch((error: Error) =>
      program.error(error.message),
    );
    const server = await startDaemon(port, context);
    const renderer = await startTui(await DaemonClient.connect(`ws://localhost:${port}`), {
      resumeSessionId: opts.session,
      onExit: printResumeHint,
    });
    renderer.on("destroy", () => {
      for (const socket of server.clients) socket.terminate();
      server.close(() => process.exit(0));
    });
  });

await program.parseAsync();
