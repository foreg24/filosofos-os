/**
 * Instantánea de procesos tal como la vería un comando en ejecución: incluye al propio comando
 * (ps, pstree, top…) y a los demás de su tubería, y calcula el "+" de primer plano de cada terminal.
 */
import { debianSystem as S } from "../debianSystem";
import { type Machine, type Proc, machine } from "./machine";
import { tableProcesses } from "./tableProcesses";

export interface Transient {
  pid: number;
  comm: string;
  cmd: string;
}

export interface ProcView extends Proc {
  /** Columna STAT completa (estado + modificadores + "+"). */
  stat: string;
  /** Columna WCHAN: función del kernel donde duerme ("-" si está en ejecución). */
  wchan: string;
}

export const MEM_TOTAL_KIB = Math.round(S.mem.totalMiB * 1024);

export interface ViewOptions {
  tty: string;
  transients?: Transient[];
}

/** WCHAN de un proceso: el suyo propio o el típico de su estado y programa. */
export function wchanOf(p: Proc): string {
  if (p.wchan) return p.wchan;
  if (p.state === "R" || p.state === "Z") return "-";
  if (p.state === "T") return "do_signal_stop";
  if (p.kernel) return p.state === "I" ? "worker_thread" : "smpboot_thread_fn";
  if (p.comm === "bash") return "do_select";
  if (p.kind === "sleep" || p.kind === "zombie") return "hrtimer_nanosleep";
  return "do_epoll_wait";
}

/** Todos los procesos vivos: los de la máquina y los de la mesa. */
export function allProcesses(m: Machine = machine()): Proc[] {
  return [...m.list(), ...tableProcesses(m.bootAt)];
}

/** Reserva PIDs para el comando y los demás de su tubería (aparecen en su propia salida). */
export function reserveTransients(names: { comm: string; cmd: string }[]): Transient[] {
  const m = machine();
  return names.map((n) => ({ ...n, pid: m.allocPid() }));
}

export function viewProcesses({ tty, transients = [] }: ViewOptions, m: Machine = machine()): ProcView[] {
  const shell = m.shell(tty);
  const now = Date.now();
  const procs: Proc[] = allProcesses(m);

  transients.forEach((t, i) => procs.push({ ...template(m, now), pid: t.pid, ppid: shell, comm: t.comm, cmd: t.cmd, tty, state: i === 0 ? "R" : "S" }));

  // Primer plano: en la terminal que ejecuta, el comando; en las demás, su trabajo o su shell.
  const fg = new Set<number>(transients.map((t) => t.pid));
  for (const other of m.ttys()) if (other !== tty) fg.add(m.foregroundOf(other) ?? m.shell(other));

  return procs
    .sort((a, b) => a.pid - b.pid)
    .map((p) => ({ ...p, stat: `${p.state}${p.flags}${fg.has(p.pid) || p.pinnedForeground ? "+" : ""}`, wchan: wchanOf(p) }));
}

function template(m: Machine, now: number): Proc {
  return {
    pid: 0,
    ppid: 0,
    user: S.username,
    comm: "",
    cmd: "",
    tty: null,
    state: "S",
    flags: "",
    threads: 1,
    tids: [],
    vsz: 7940,
    rss: 3968,
    cpu: 0,
    started: now - m.bootAt,
    cpuTime: 0,
    kernel: false,
    protected: false,
    reaps: true,
  };
}

/* ---------------------------------------------------------- columnas -- */

/** ps trunca los usuarios de más de 8 caracteres: "exposiciónSO" → "exposic+". */
export const userColumn = (user: string) => (user.length > 8 ? `${user.slice(0, 7)}+` : user);

export function startColumn(m: Machine, p: Proc) {
  const at = new Date(m.bootAt + p.started);
  const today = new Date();
  if (at.toDateString() === today.toDateString()) return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return `${at.toLocaleString("en-US", { month: "short" })}${String(at.getDate()).padStart(2, "0")}`;
}

export function cpuSeconds(m: Machine, p: Proc) {
  return m.cpuTimeOf(p);
}

/** %CPU de ps: CPU acumulada / tiempo de vida. */
export function lifetimeCpu(m: Machine, p: Proc) {
  const alive = (Date.now() - (m.bootAt + p.started)) / 1000;
  return alive > 0 ? Math.min(99.9, (cpuSeconds(m, p) / alive) * 100) : 0;
}

export const memPercent = (p: Proc) => (p.rss / MEM_TOTAL_KIB) * 100;

export const timeShort = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const timeLong = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
