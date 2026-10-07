/** Formatos de salida de `ps` (procps-ng), con las mismas columnas y anchos. */
import { machine } from "./machine";
import { type ProcView, cpuSeconds, lifetimeCpu, memPercent, startColumn, timeLong, timeShort, userColumn } from "./processView";

const tty = (p: ProcView) => p.tty ?? "?";

export function psAux(procs: ProcView[]): string[] {
  const m = machine();
  return [
    "USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND",
    ...procs.map(
      (p) =>
        `${userColumn(p.user).padEnd(8)} ${String(p.pid).padStart(7)} ${lifetimeCpu(m, p).toFixed(1).padStart(4)} ${memPercent(p).toFixed(1).padStart(4)} ${String(p.vsz).padStart(6)} ${String(p.rss).padStart(5)} ${tty(p).padEnd(8)} ${p.stat.padEnd(4)} ${startColumn(m, p).padStart(5)} ${timeShort(cpuSeconds(m, p)).padStart(6)} ${p.cmd}`,
    ),
  ];
}

export function psFull(procs: ProcView[]): string[] {
  const m = machine();
  return [
    "UID          PID    PPID  C STIME TTY          TIME CMD",
    ...procs.map(
      (p) =>
        `${userColumn(p.user).padEnd(8)} ${String(p.pid).padStart(7)} ${String(p.ppid).padStart(7)} ${String(Math.floor(lifetimeCpu(m, p))).padStart(2)} ${startColumn(m, p).padEnd(5)} ${tty(p).padEnd(8)} ${timeLong(cpuSeconds(m, p)).padStart(8)} ${p.cmd}`,
    ),
  ];
}

export function psDefault(procs: ProcView[]): string[] {
  const m = machine();
  return ["    PID TTY          TIME CMD", ...procs.map((p) => `${String(p.pid).padStart(7)} ${tty(p).padEnd(8)} ${timeLong(cpuSeconds(m, p)).padStart(8)} ${p.comm}`)];
}

/** Columnas de `ps -o`: nombre → [cabecera, ancho (negativo = alineado a la izquierda), valor]. */
const COLUMNS: Record<string, [string, number, (p: ProcView) => string]> = {
  pid: ["PID", 7, (p) => String(p.pid)],
  ppid: ["PPID", 7, (p) => String(p.ppid)],
  user: ["USER", -8, (p) => userColumn(p.user)],
  uid: ["UID", 5, (p) => (p.user === "root" ? "0" : "1000")],
  stat: ["STAT", -4, (p) => p.stat],
  state: ["S", 1, (p) => p.state],
  s: ["S", 1, (p) => p.state],
  comm: ["COMMAND", -15, (p) => p.comm],
  cmd: ["CMD", 0, (p) => p.cmd],
  args: ["COMMAND", 0, (p) => p.cmd],
  command: ["COMMAND", 0, (p) => p.cmd],
  "%cpu": ["%CPU", 4, (p) => lifetimeCpu(machine(), p).toFixed(1)],
  pcpu: ["%CPU", 4, (p) => lifetimeCpu(machine(), p).toFixed(1)],
  "%mem": ["%MEM", 4, (p) => memPercent(p).toFixed(1)],
  pmem: ["%MEM", 4, (p) => memPercent(p).toFixed(1)],
  tty: ["TT", -8, tty],
  tt: ["TT", -8, tty],
  nlwp: ["NLWP", 4, (p) => String(p.threads)],
  vsz: ["VSZ", 6, (p) => String(p.vsz)],
  rss: ["RSS", 5, (p) => String(p.rss)],
  time: ["TIME", 8, (p) => timeLong(cpuSeconds(machine(), p))],
  wchan: ["WCHAN", -6, (p) => p.wchan],
};

export const psColumnNames = Object.keys(COLUMNS);

/** "wchan:22" → la columna wchan con 22 caracteres de ancho (mismo alineado). */
function column(spec: string): (typeof COLUMNS)[string] | undefined {
  const [name, width] = spec.toLowerCase().split(":");
  const col = COLUMNS[name];
  if (!col || width === undefined) return col;
  const w = Number(width);
  if (!Number.isInteger(w) || w <= 0) return undefined;
  return [col[0], col[1] < 0 ? -w : w, col[2]];
}

export function psCustom(procs: ProcView[], fields: string[]): string[] | { error: string } {
  const found = fields.map(column);
  const bad = fields.find((f, i) => !found[i]);
  if (bad) return { error: `error: unknown user-defined format specifier "${bad}"` };
  const cols = found as (typeof COLUMNS)[string][];
  const cell = (col: (typeof COLUMNS)[string], value: string, last: boolean) => {
    const width = col[1];
    return width === 0 || last ? value : width < 0 ? value.padEnd(-width) : value.padStart(width);
  };
  const row = (values: string[]) => values.map((v, i) => cell(cols[i], v, i === cols.length - 1)).join(" ").trimEnd();
  return [row(cols.map((c) => c[0])), ...procs.map((p) => row(cols.map((c) => c[2](p))))];
}
