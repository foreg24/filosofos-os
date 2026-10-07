/**
 * Tabla de procesos de la máquina, compartida por todas las terminales de la página.
 * Modela lo que pide el laboratorio: estados (R, S, T, Z…), señales, trabajos de bash,
 * padres e hijos, huérfanos adoptados por init y zombis que nadie recoge.
 */
import { debianSystem as S } from "../debianSystem";
import { type BaseProc, baseProcesses } from "./baseProcesses";
import { SIGNAL_MESSAGES, type Signal } from "./signals";

export type ProcKind = "shell" | "sleep" | "zombie" | "program";

export interface Proc {
  pid: number;
  ppid: number;
  user: string;
  comm: string;
  cmd: string;
  tty: string | null;
  /** Letra de estado (R, S, D, T, Z, I). */
  state: string;
  /** Modificadores fijos (s, l, <, N…); el "+" se calcula según el primer plano. */
  flags: string;
  threads: number;
  tids: number[];
  vsz: number;
  rss: number;
  cpu: number;
  /** ms desde el arranque. */
  started: number;
  cpuTime: number;
  kernel: boolean;
  protected: boolean;
  kind?: ProcKind;
  /** false: no hace wait() de sus hijos (sus hijos terminados quedan zombis). */
  reaps: boolean;
  /** Programa temporizado (sleep, ./zombie): el tiempo detenido no cuenta. */
  timer?: { duration: number; elapsed: number; since: number | null };
  /** Señal que espera a SIGCONT para actuar (un proceso detenido no muere hasta reanudarse). */
  pending?: Signal;
  /** Primer plano fijo de otra terminal (la sesión gráfica en tty2). */
  pinnedForeground?: boolean;
  /** Función del kernel donde duerme (columna WCHAN); si falta, se deduce del estado. */
  wchan?: string;
}

export interface Job {
  id: number;
  pid: number;
  command: string;
  status: string;
  background: boolean;
}

export type MachineEvent =
  | { type: "exit"; pid: number; signal: Signal | null }
  | { type: "stop"; pid: number; signal: Signal }
  | { type: "shell-exit"; tty: string; pid: number; signal: Signal | null; login: boolean };

const LOGIN: Record<string, number> = { "pts/0": 1532, "pts/1": 1788 };
const TERMINAL_SERVER = 1515;
const FATAL: Signal[] = ["HUP", "INT", "QUIT", "KILL", "TERM", "USR1", "USR2", "PIPE", "ALRM", "ABRT", "SEGV"];
/** Bash interactivo ignora SIGTERM, SIGINT y SIGQUIT (por eso el laboratorio usa kill -9). */
const SHELL_IGNORES: Signal[] = ["TERM", "INT", "QUIT"];

export class Machine {
  readonly bootAt: number;
  private readonly procs = new Map<number, Proc>();
  private readonly sessions = new Map<string, number[]>();
  private readonly jobs = new Map<number, Job[]>();
  private readonly notes = new Map<number, string[]>();
  private readonly foreground = new Map<string, number>();
  private readonly lastBackground = new Map<number, number>();
  private readonly exitWarned = new Set<number>();
  private readonly listeners = new Set<(e: MachineEvent) => void>();
  private readonly loadedAt: number;
  private nextPid = 2560;
  private spawned = 0;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(now = Date.now()) {
    this.loadedAt = now;
    this.bootAt = now - (S.uptimeAtLoad.hours * 60 + S.uptimeAtLoad.minutes) * 60_000;
    const base = baseProcesses();
    const used = new Set(base.map((b) => b.pid));
    let tid = 1;
    for (const b of base) {
      const tids: number[] = [];
      for (let t = 1; t < b.threads; t++) {
        tid = Math.max(tid, b.pid + 1);
        while (used.has(tid)) tid++;
        used.add(tid);
        tids.push(tid);
      }
      this.procs.set(b.pid, this.fromBase(b, tids));
    }
    for (const [tty, pid] of Object.entries(LOGIN)) this.sessions.set(tty, [pid]);
  }

  private fromBase(b: BaseProc, tids: number[]): Proc {
    const m = b.stat.match(/^([RSDTZI])(.*)$/);
    return {
      pid: b.pid,
      ppid: b.ppid,
      user: b.user,
      comm: b.comm,
      cmd: b.cmd,
      tty: b.tty ?? null,
      state: m?.[1] ?? "S",
      flags: (m?.[2] ?? "").replace("+", ""),
      pinnedForeground: b.stat.includes("+"),
      threads: b.threads,
      tids,
      vsz: b.vsz,
      rss: b.rss,
      cpu: b.cpu,
      started: b.start * 60_000,
      cpuTime: b.time,
      kernel: Boolean(b.kernel),
      protected: Boolean(b.protected),
      kind: b.comm === "bash" ? "shell" : undefined,
      reaps: true,
    };
  }

  /* ------------------------------------------------------------- lectura -- */

  get(pid: number) {
    return this.procs.get(pid);
  }

  /** Procesos ordenados por PID, con los temporizadores al día. */
  list(): Proc[] {
    this.sync();
    return [...this.procs.values()].sort((a, b) => a.pid - b.pid);
  }

  /** Segundos de CPU acumulados ahora (los procesos activos siguen consumiendo). */
  cpuTimeOf(p: Proc, now = Date.now()) {
    return p.cpuTime + ((now - this.loadedAt) / 1000) * (p.cpu / 100);
  }

  session(tty: string): number[] {
    let stack = this.sessions.get(tty);
    if (!stack || !stack.length) {
      stack = [this.spawnLogin(tty)];
      this.sessions.set(tty, stack);
    }
    return stack;
  }

  shell(tty: string) {
    const stack = this.session(tty);
    return stack[stack.length - 1];
  }

  /** Terminales con sesión abierta. */
  ttys() {
    return [...this.sessions.keys()];
  }

  foregroundOf(tty: string) {
    return this.foreground.get(tty) ?? null;
  }

  setForeground(tty: string, pid: number | null) {
    if (pid === null) this.foreground.delete(tty);
    else this.foreground.set(tty, pid);
  }

  lastBackgroundOf(shell: number) {
    return this.lastBackground.get(shell);
  }

  subscribe(listener: (e: MachineEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(e: MachineEvent) {
    this.listeners.forEach((l) => l(e));
  }

  /* ------------------------------------------------------- ciclo de vida -- */

  allocPid() {
    this.spawned++;
    this.nextPid += this.spawned % 3 === 0 ? 2 : 1;
    while (this.procs.has(this.nextPid)) this.nextPid++;
    return this.nextPid;
  }

  spawn(opts: {
    ppid: number;
    comm: string;
    cmd: string;
    tty: string | null;
    kind?: ProcKind;
    duration?: number;
    reaps?: boolean;
    flags?: string;
    vsz?: number;
    rss?: number;
  }): number {
    const pid = this.allocPid();
    const now = Date.now();
    this.procs.set(pid, {
      pid,
      ppid: opts.ppid,
      user: S.username,
      comm: opts.comm.slice(0, 15),
      cmd: opts.cmd,
      tty: opts.tty,
      state: "S",
      flags: opts.flags ?? "",
      threads: 1,
      tids: [],
      vsz: opts.vsz ?? 5480,
      rss: opts.rss ?? 1920,
      cpu: 0,
      started: now - this.bootAt,
      cpuTime: 0,
      kernel: false,
      protected: false,
      kind: opts.kind,
      reaps: opts.reaps ?? true,
      timer: opts.duration !== undefined ? { duration: opts.duration, elapsed: 0, since: now } : undefined,
    });
    this.schedule();
    return pid;
  }

  private spawnLogin(tty: string) {
    return this.spawn({ ppid: TERMINAL_SERVER, comm: "bash", cmd: "bash", tty, kind: "shell", flags: "s", vsz: 10132, rss: 5504 });
  }

  /** Abre un bash hijo del actual en la misma terminal (lo que hace escribir `bash`). */
  pushShell(tty: string) {
    const pid = this.spawn({ ppid: this.shell(tty), comm: "bash", cmd: "bash", tty, kind: "shell", vsz: 10132, rss: 5376 });
    this.session(tty).push(pid);
    return pid;
  }

  /** Avanza los temporizadores: los programas que terminan salen con código 0. */
  sync(now = Date.now()) {
    for (const p of [...this.procs.values()]) {
      const t = p.timer;
      if (!t || t.since === null || p.state === "Z") continue;
      if (t.elapsed + (now - t.since) >= t.duration) this.terminate(p.pid, null);
    }
    this.schedule();
  }

  private schedule() {
    if (typeof window === "undefined") return;
    if (this.timeout) clearTimeout(this.timeout);
    const now = Date.now();
    let next = Infinity;
    for (const p of this.procs.values()) {
      const t = p.timer;
      if (t && t.since !== null && p.state !== "Z") next = Math.min(next, t.duration - t.elapsed - (now - t.since));
    }
    if (next < Infinity) this.timeout = setTimeout(() => this.sync(), Math.max(0, next) + 10);
  }

  /** Termina un proceso: sus hijos quedan huérfanos (los adopta init) y el padre lo recoge o no. */
  terminate(pid: number, signal: Signal | null) {
    const p = this.procs.get(pid);
    if (!p || p.state === "Z") return;

    for (const child of this.procs.values()) {
      if (child.ppid !== pid) continue;
      child.ppid = 1;
      if (child.state === "Z") this.procs.delete(child.pid);
    }

    const parent = this.procs.get(p.ppid);
    if (parent && !parent.reaps && parent.state !== "Z") {
      Object.assign(p, { state: "Z", flags: "", cmd: `[${p.comm}] <defunct>`, vsz: 0, rss: 0, threads: 1, tids: [], timer: undefined });
    } else {
      this.procs.delete(pid);
    }

    this.updateJob(pid, signal ? SIGNAL_MESSAGES[signal] : "Done");
    for (const [tty, fg] of this.foreground) if (fg === pid) this.foreground.delete(tty);
    this.emit({ type: "exit", pid, signal });

    if (p.kind === "shell") this.shellEnded(p, signal);
    this.schedule();
  }

  private shellEnded(p: Proc, signal: Signal | null) {
    for (const [tty, stack] of this.sessions) {
      const i = stack.indexOf(p.pid);
      if (i < 0) continue;
      stack.splice(i);
      const login = i === 0;
      if (login) this.sessions.delete(tty);
      this.emit({ type: "shell-exit", tty, pid: p.pid, signal, login });
    }
    this.jobs.delete(p.pid);
    this.notes.delete(p.pid);
  }

  /**
   * Entrega una señal como lo haría el kernel.
   * @returns un mensaje de error de bash, o null si se entregó.
   */
  signal(pid: number, signal: Signal): string | null {
    this.sync();
    const p = this.procs.get(pid);
    if (!p) return `(${pid}) - No such process`;
    if (p.user !== S.username) return `(${pid}) - Operation not permitted`;
    if (p.state === "Z") return null; // a un zombi no se le puede matar: ya terminó
    if (p.protected && (FATAL.includes(signal) || signal === "STOP" || signal === "TSTP")) return "protected";

    if (signal === "STOP" || signal === "TSTP") {
      if (p.state === "T") return null;
      if (p.timer && p.timer.since !== null) {
        p.timer.elapsed += Date.now() - p.timer.since;
        p.timer.since = null;
      }
      p.state = "T";
      this.updateJob(pid, signal === "STOP" ? "Stopped (signal)" : "Stopped");
      this.emit({ type: "stop", pid, signal });
      this.schedule();
      return null;
    }

    if (signal === "CONT") {
      if (p.state !== "T") return null;
      p.state = "S";
      if (p.timer) p.timer.since = Date.now();
      this.updateJob(pid, "Running");
      const pending = p.pending;
      p.pending = undefined;
      if (pending) this.terminate(pid, pending);
      this.schedule();
      return null;
    }

    if (!FATAL.includes(signal)) return null;
    if (p.kind === "shell" && SHELL_IGNORES.includes(signal)) return null;
    // Con SIGHUP, bash reenvía la señal a sus trabajos antes de terminar.
    if (p.kind === "shell" && signal === "HUP") for (const job of [...(this.jobs.get(pid) ?? [])]) this.signal(job.pid, "HUP");
    if (p.state === "T" && signal !== "KILL") {
      p.pending = signal;
      return null;
    }
    this.terminate(pid, signal);
    return null;
  }

  /** `exit` en un bash hijo: si deja trabajos detenidos, avisa la primera vez (como bash). */
  exitShell(tty: string, force: boolean): "stopped-jobs" | "exited" | "login" {
    const stack = this.session(tty);
    const pid = stack[stack.length - 1];
    const stopped = (this.jobs.get(pid) ?? []).some((j) => j.status.startsWith("Stopped"));
    if (stopped && !force) return "stopped-jobs";
    for (const job of [...(this.jobs.get(pid) ?? [])]) if (job.status.startsWith("Stopped")) this.signal(job.pid, "HUP");
    if (stack.length === 1) {
      this.terminate(pid, null);
      return "login";
    }
    this.terminate(pid, null);
    return "exited";
  }

  /** Bash avisa una vez de los trabajos detenidos; un segundo `exit` seguido cierra igualmente. */
  consumeExitWarning(shell: number) {
    const warned = this.exitWarned.has(shell);
    this.exitWarned.add(shell);
    return warned;
  }

  clearExitWarning(shell: number) {
    this.exitWarned.delete(shell);
  }

  /* ------------------------------------------------------------ trabajos -- */

  /** Comando corto lanzado con & (ls &, whoami &…): termina al instante y bash lo avisa como Done. */
  addFinishedJob(shell: number, command: string) {
    const list = this.jobs.get(shell) ?? [];
    const id = list.reduce((m, j) => Math.max(m, j.id), 0) + 1;
    const pid = this.allocPid();
    this.lastBackground.set(shell, pid);
    this.notes.set(shell, [...(this.notes.get(shell) ?? []), `[${id}]+  ${"Done".padEnd(24)}${command}`]);
    return { id, pid };
  }

  addJob(shell: number, pid: number, command: string, background: boolean): Job {
    const list = this.jobs.get(shell) ?? [];
    const id = list.reduce((m, j) => Math.max(m, j.id), 0) + 1;
    const job = { id, pid, command, status: "Running", background };
    list.push(job);
    this.jobs.set(shell, list);
    if (background) this.lastBackground.set(shell, pid);
    return job;
  }

  jobsOf(shell: number) {
    this.sync();
    return this.jobs.get(shell) ?? [];
  }

  /** Marca + y - como bash: el trabajo más reciente es el actual. */
  jobMark(shell: number, job: Job) {
    const list = this.jobs.get(shell) ?? [];
    const i = list.indexOf(job);
    if (i === list.length - 1) return "+";
    if (i === list.length - 2) return "-";
    return " ";
  }

  findJob(shell: number, spec?: string): Job | undefined {
    const list = this.jobsOf(shell).filter((j) => !["Done", "Killed", "Terminated"].includes(j.status));
    if (!spec || spec === "%" || spec === "%+" || spec === "%%") return list[list.length - 1];
    if (spec === "%-") return list[list.length - 2];
    const n = Number(spec.replace(/^%/, ""));
    return list.find((j) => j.id === n);
  }

  private updateJob(pid: number, status: string) {
    for (const [shell, list] of this.jobs) {
      const job = list.find((j) => j.pid === pid);
      if (!job || job.status === status) continue;
      const mark = this.jobMark(shell, job);
      job.status = status;
      const finished = !status.startsWith("Stopped") && status !== "Running";
      // Bash avisa antes del siguiente prompt; el fin de un trabajo en primer plano lo muestra la terminal.
      if (status !== "Running" && (job.background || !finished)) {
        const text = `[${job.id}]${mark}  ${status.padEnd(24)}${job.command}`;
        this.notes.set(shell, [...(this.notes.get(shell) ?? []), text]);
      }
      if (finished) list.splice(list.indexOf(job), 1);
      if (!finished && status.startsWith("Stopped")) job.background = true;
    }
  }

  /** Avisos pendientes de trabajos (Done, Stopped…) que bash imprime antes del prompt. */
  takeNotes(shell: number): string[] {
    this.sync();
    const notes = this.notes.get(shell) ?? [];
    this.notes.delete(shell);
    return notes;
  }
}

let instance: Machine | null = null;

/** La máquina se crea al primer comando, en el navegador (nunca durante el render del servidor). */
export function machine(): Machine {
  instance ??= new Machine();
  return instance;
}
