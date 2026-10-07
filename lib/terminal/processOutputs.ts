/**
 * `top` y `htop`: instantáneas de la misma tabla de procesos que usan ps y pstree,
 * coherentes con la memoria y los núcleos de `debianSystem`.
 */
import type { OutputLine } from "@/types/terminal";
import { debianSystem as S } from "./debianSystem";
import { machine } from "./processes/machine";
import { type ProcView, MEM_TOTAL_KIB, cpuSeconds, userColumn } from "./processes/processView";
import { line, spans } from "./terminalTypes";

interface ProcessSnapshot {
  now: Date;
  sessionStart: number;
  /** Procesos vistos por el propio top/htop (incluido él mismo). */
  procs: ProcView[];
  /** PID del propio top/htop. */
  self: number;
}

const mem = (kib: number) => ((kib / MEM_TOTAL_KIB) * 100).toFixed(1);
const clock = (d: Date) => d.toTimeString().slice(0, 8);
const virt = (kib: number) => (kib >= 10_000_000 ? `${(kib / 1048576).toFixed(1)}g` : String(kib));
const timePlus = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;

function uptime(now: Date, sessionStart: number) {
  const minutes = S.uptimeAtLoad.hours * 60 + S.uptimeAtLoad.minutes + Math.floor((now.getTime() - sessionStart) / 60000);
  return { h: Math.floor(minutes / 60), m: minutes % 60, s: Math.floor((now.getTime() - sessionStart) / 1000) % 60 };
}

function counts(procs: ProcView[]) {
  const by = (states: string) => procs.filter((p) => states.includes(p.state)).length;
  return { total: procs.length, running: by("R"), sleeping: by("SDI"), stopped: by("T"), zombie: by("Z") };
}

/** Los que más CPU usan ahora (el propio top incluido), como la vista por defecto. */
function busiest(procs: ProcView[], self: number, n: number): ProcView[] {
  const rank = (p: ProcView) => (p.pid === self ? 0.3 : p.cpu) + (p.state === "R" ? 0.05 : 0);
  return [...procs].sort((a, b) => rank(b) - rank(a) || a.pid - b.pid).slice(0, n);
}

const instantCpu = (p: ProcView, self: number) => (p.pid === self ? 0.3 : p.cpu);
const tone = (p: ProcView) => (p.comm.startsWith("filosofo-") || p.comm === "mesa-filosofos" ? "info" : p.state === "Z" ? "error" : undefined);

export function top({ now, sessionStart, procs, self }: ProcessSnapshot): OutputLine[] {
  const up = uptime(now, sessionStart);
  const c = counts(procs);
  const m = S.mem;
  const sw = S.swapMiB;
  const f = (n: number, w = 8) => n.toFixed(1).padStart(w);
  const header = "    PID USER          PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND";
  const mach = machine();
  return [
    line(`top - ${clock(now)} up ${up.h}:${String(up.m).padStart(2, "0")},  1 user,  load average: 0.08, 0.05, 0.02`),
    line(
      `Tasks: ${String(c.total).padStart(3)} total, ${String(c.running).padStart(3)} running, ${String(c.sleeping).padStart(3)} sleeping, ${String(c.stopped).padStart(3)} stopped, ${String(c.zombie).padStart(3)} zombie`,
    ),
    line("%Cpu(s):  2.5 us,  0.8 sy,  0.0 ni, 96.3 id,  0.3 wa,  0.0 hi,  0.1 si,  0.0 st"),
    line(`MiB Mem : ${f(m.totalMiB)} total, ${f(m.freeMiB)} free, ${f(m.usedMiB)} used, ${f(m.buffCacheMiB)} buff/cache`),
    line(`MiB Swap: ${f(sw.totalMiB)} total, ${f(sw.totalMiB - sw.usedMiB)} free, ${f(sw.usedMiB)} used. ${f(m.availableMiB)} avail Mem`),
    line(""),
    line(header, "strong"),
    ...busiest(procs, self, 12).map((p) =>
      line(
        `${String(p.pid).padStart(7)} ${userColumn(p.user).padEnd(9)}${p.kernel ? " 20   0" : " 20   0"} ${virt(p.vsz).padStart(7)} ${String(p.rss).padStart(6)} ${String(Math.round(p.rss * 0.6)).padStart(6)} ${p.state} ${instantCpu(p, self).toFixed(1).padStart(5)} ${mem(p.rss).padStart(5)} ${timePlus(cpuSeconds(mach, p)).padStart(9)} ${p.comm}`,
        tone(p),
      ),
    ),
    line(""),
    line("Snapshot mode (equivalent to top -b -n 1).", "muted"),
  ];
}

function bar(label: string, fraction: number, text: string, width = 30): OutputLine {
  const inner = width - text.length;
  const filled = Math.max(fraction > 0 ? 1 : 0, Math.round(fraction * inner));
  return spans({ text: `${label.padStart(5)}[` }, { text: "|".repeat(filled), tone: "info" }, { text: `${" ".repeat(inner - filled)}${text}]` });
}

export function htop({ now, sessionStart, procs, self }: ProcessSnapshot): OutputLine[] {
  const up = uptime(now, sessionStart);
  const m = S.mem;
  const c = counts(procs);
  const threads = procs.reduce((n, p) => n + (p.kernel ? 0 : p.threads), 0);
  const kthreads = procs.filter((p) => p.kernel).length;
  const gib = (mib: number) => `${(mib / 1024).toFixed(2)}G`;
  const cpu = [2.5, 0.8];
  const meters = [
    ...Array.from({ length: S.cpuCores }, (_, i) => bar(String(i), (cpu[i] ?? 0.5) / 100, `${(cpu[i] ?? 0.5).toFixed(1)}%`)),
    bar("Mem", m.usedMiB / m.totalMiB, `${gib(m.usedMiB)}/${gib(m.totalMiB)}`),
    bar("Swp", S.swapMiB.usedMiB / S.swapMiB.totalMiB, `0K/${gib(S.swapMiB.totalMiB)}`),
  ];
  const side = [
    `Tasks: ${c.total - kthreads}, ${threads} thr, ${kthreads} kthr; ${c.running} running`,
    "Load average: 0.08 0.05 0.02",
    `Uptime: ${String(up.h).padStart(2, "0")}:${String(up.m).padStart(2, "0")}:${String(up.s).padStart(2, "0")}`,
    "",
  ];
  const mach = machine();
  return [
    ...meters.map((l, i) => ({ spans: [...l.spans, { text: side[i] ? `   ${side[i]}` : "" }] })),
    line(""),
    line("    PID USER          PRI  NI  VIRT   RES   SHR S  CPU% MEM%   TIME+  Command", "strong"),
    ...busiest(procs, self, 10).map((p) =>
      line(
        `${String(p.pid).padStart(7)} ${userColumn(p.user).padEnd(13)} 20   0 ${virt(p.vsz).padStart(5)} ${`${Math.round(p.rss / 1024)}M`.padStart(5)} ${`${Math.round((p.rss * 0.6) / 1024)}M`.padStart(5)} ${p.state} ${instantCpu(p, self).toFixed(1).padStart(5)} ${mem(p.rss).padStart(4)} ${timePlus(cpuSeconds(mach, p)).padStart(8)}  ${p.cmd}`,
        tone(p),
      ),
    ),
    line(""),
    line("F1Help  F2Setup  F3Search  F4Filter  F5Tree  F6SortBy  F7Nice-  F8Nice+  F9Kill  F10Quit", "muted"),
  ];
}
