import type { WebSocket } from "ws";
import type { DaemonContext } from "./daemonContext.ts";

export type ConnectionMode = "own" | "attach";

export type AdmissionInfo = {
  runId: string;
  mode: ConnectionMode;
  cwd?: string;
};

type Admission = AdmissionInfo & { context?: DaemonContext };

export class DaemonHub {
  private readonly admissions = new Map<WebSocket, Admission>();
  private attachFallback?: Promise<DaemonContext>;

  constructor(
    private readonly create: () => Promise<DaemonContext>,
    private root?: DaemonContext,
  ) {}

  setRoot(context: DaemonContext): void {
    this.root = context;
  }

  clientIds(): string[] {
    return [...this.admissions.values()].map((admission) => admission.runId);
  }

  admit(socket: WebSocket, info: AdmissionInfo): void {
    const context = info.mode === "attach" ? this.attachTarget() : undefined;
    this.admissions.set(socket, { ...info, context });
  }

  async contextFor(socket: WebSocket): Promise<DaemonContext> {
    const admission = this.requireAdmission(socket);
    if (admission.context) return admission.context;
    const context = await this.resolveContext(admission);
    if (admission.cwd) await context.adoptDirectory(admission.cwd);
    admission.context = context;
    this.bindPendingAttaches(context);
    return context;
  }

  socketsOf(context: DaemonContext): WebSocket[] {
    const sockets: WebSocket[] = [];
    for (const [socket, admission] of this.admissions)
      if (admission.context === context) sockets.push(socket);
    return sockets;
  }

  release(socket: WebSocket): void {
    const admission = this.admissions.get(socket);
    this.admissions.delete(socket);
    if (!admission?.context) return;
    for (const other of this.admissions.values()) if (other.context === admission.context) return;
    admission.context.agents.closeAll();
  }

  closeAllAgents(): void {
    const contexts = new Set<DaemonContext>();
    for (const admission of this.admissions.values())
      if (admission.context) contexts.add(admission.context);
    if (this.root) contexts.add(this.root);
    for (const context of contexts) context.agents.closeAll();
  }

  private async resolveContext(admission: Admission): Promise<DaemonContext> {
    if (admission.mode !== "attach") return this.create();
    const target = this.attachTarget();
    if (target) return target;
    this.attachFallback ??= this.create()
      .then((context) => {
        this.root = context;
        return context;
      })
      .finally(() => {
        this.attachFallback = undefined;
      });
    return this.attachFallback;
  }

  private bindPendingAttaches(context: DaemonContext): void {
    for (const admission of this.admissions.values())
      if (admission.mode === "attach" && !admission.context) admission.context = context;
  }

  private attachTarget(): DaemonContext | undefined {
    for (const admission of this.admissions.values())
      if (admission.context) return admission.context;
    return this.root;
  }

  private requireAdmission(socket: WebSocket): Admission {
    const admission = this.admissions.get(socket);
    if (!admission) throw new Error("Socket was never admitted to the daemon hub");
    return admission;
  }
}
