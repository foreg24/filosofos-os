/**
 * Comandos de procesos del laboratorio: ps, pstree, kill, jobs, fg, bg, sleep, bash, exit,
 * pgrep, pidof. Operan sobre la tabla de procesos (lib/terminal/processes).
 */
import { splitFlags } from "./commandParser";
import { machine } from "./processes/machine";
import { psAux, psColumnNames, psCustom, psDefault, psFull } from "./processes/psFormat";
import { pstree } from "./processes/pstree";
import { type ProcView, viewProcesses } from "./processes/processView";
import { SIGNAL_MESSAGES, type Signal, parseSignal, signalTable as signalList } from "./processes/signals";
import { isTablePid, tableActive } from "./processes/tableProcesses";
import { bannerLines } from "./terminalState";
import { type CommandContext, type CommandHandler, line, lines, out } from "./terminalTypes";

export { psColumnNames };

const err = (text: string) => out(line(text, "error"));
const view = (ctx: CommandContext) => viewProcesses({ tty: ctx.tty, transients: ctx.transients });

/** Señales a los procesos de la mesa: actúan sobre la simulación entera, como en filosofos.py. */
function signalTable(signal: Signal, ctx: CommandContext) {
  const { status, mode } = ctx.sim.getState();
  if (signal === "STOP" || signal === "TSTP") ctx.sim.pause();
  else if (signal === "CONT") {
    if (status === "running" || status === "resolved") ctx.sim.play();
  } else if (FATAL_SIGNALS.includes(signal)) ctx.sim.reset(mode);
}
const FATAL_SIGNALS: Signal[] = ["HUP", "INT", "QUIT", "KILL", "TERM"];

/* ------------------------------------------------------------------ ps -- */

const PS_USAGE = ["", "Usage:", " ps [options]", "", " Try 'ps --help <simple|list|output|threads|misc|all>'", "  or 'ps --help <s|l|o|t|m|a>'", " for additional help text.", "", "For more details see ps(1)."];

const ps: CommandHandler = (args, ctx) => {
  let format: "default" | "aux" | "full" | "custom" = "default";
  let scope: "tty" | "all" | "pids" = "tty";
  let pids: number[] = [];
  let fields: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const bsd = a.replace(/^-/, "");
    if (/^[aux]+$/.test(bsd) && bsd.includes("u") && bsd.includes("a") && bsd.includes("x")) [format, scope] = ["aux", "all"];
    else if (a === "ax" || a === "-A" || a === "-e") scope = "all";
    else if (a === "-ef" || a === "-fe" || a === "-eF") [format, scope] = ["full", "all"];
    else if (a === "-f") format = "full";
    else if (a === "-p" || a === "p" || a === "--pid") {
      pids = (args[++i] ?? "").split(",").map(Number).filter((n) => n > 0);
      if (!pids.length) return out(line("error: list of process IDs must follow -p", "error"), ...lines(PS_USAGE.join("\n")));
      scope = "pids";
    } else if (a === "-o" || a === "o") {
      fields = (args[++i] ?? "").split(",").filter(Boolean);
      if (!fields.length) return out(line("error: format specification must follow -o", "error"), ...lines(PS_USAGE.join("\n")));
      format = "custom";
    } else if (/^\d+(,\d+)*$/.test(a)) {
      pids = a.split(",").map(Number);
      scope = "pids";
    } else return out(line(`error: unsupported option (${a.startsWith("-") ? "SysV" : "BSD"} syntax)`, "error"), ...lines(PS_USAGE.join("\n")));
  }

  const all = view(ctx);
  const selected: ProcView[] = scope === "all" ? all : scope === "pids" ? all.filter((p) => pids.includes(p.pid)) : all.filter((p) => p.tty === ctx.tty);
  if (format === "custom") {
    const result = psCustom(selected, fields);
    return Array.isArray(result) ? out(...lines(result.join("\n"))) : err(result.error);
  }
  const text = format === "aux" ? psAux(selected) : format === "full" ? psFull(selected) : psDefault(selected);
  return out(...text.map((t) => line(t)));
};

/* -------------------------------------------------------------- pstree -- */

const pstreeCmd: CommandHandler = (args, ctx) => {
  const { flags, operands } = splitFlags(args);
  const bad = [...flags].find((f) => f !== "p");
  if (bad) return out(line(`pstree: invalid option -- '${bad}'`, "error"), line("Usage: pstree [-p] [PID]"));
  const root = operands[0] ? Number(operands[0]) : 1;
  if (!Number.isInteger(root)) return err(`pstree: invalid PID '${operands[0]}'`);
  const tree = pstree(view(ctx), root, flags.has("p"));
  return out(...(tree ?? []).map((t) => line(t)));
};

/* ---------------------------------------------------------------- kill -- */

const KILL_USAGE = "kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]";

const kill: CommandHandler = (args, ctx) => {
  const m = machine();
  if (!args.length) return err(KILL_USAGE);
  if (args[0] === "-l" || args[0] === "-L") return out(...signalList().map((t) => line(t)));

  let signal = parseSignal("TERM");
  let targets = args;
  if (args[0] === "-s" || args[0] === "-n") {
    signal = parseSignal(args[1] ?? "");
    targets = args.slice(2);
    if (!signal) return err(`bash: kill: ${args[1] ?? ""}: invalid signal specification`);
  } else if (args[0].startsWith("-") && args[0].length > 1) {
    signal = parseSignal(args[0].slice(1));
    targets = args.slice(1);
    if (!signal) return err(`bash: kill: ${args[0].slice(1)}: invalid signal specification`);
  }
  if (!targets.length || !signal) return err(KILL_USAGE);

  const result = [];
  for (const target of targets) {
    let pid: number;
    if (target.startsWith("%")) {
      const job = m.findJob(ctx.shell, target);
      if (!job) {
        result.push(line(`bash: kill: ${target}: no such job`, "error"));
        continue;
      }
      pid = job.pid;
    } else if (/^\d+$/.test(target)) pid = Number(target);
    else {
      result.push(line(`bash: kill: ${target}: arguments must be process or job IDs`, "error"));
      continue;
    }
    if (isTablePid(pid) && tableActive()) {
      signalTable(signal, ctx);
      continue;
    }
    const error = m.signal(pid, signal);
    if (error === "protected") result.push(line(`bash: kill: (${pid}) - Operation not permitted`, "error"));
    else if (error) result.push(line(`bash: kill: ${error}`, "error"));
  }
  return { kind: "output", lines: result };
};

/* ------------------------------------------------------ trabajos (jobs) -- */

const jobs: CommandHandler = (args, ctx) => {
  const m = machine();
  const { flags } = splitFlags(args);
  const list = m.jobsOf(ctx.shell);
  if (flags.has("p")) return out(...list.map((j) => line(String(j.pid))));
  return out(
    ...list.map((j) => {
      const mark = m.jobMark(ctx.shell, j);
      const suffix = j.status === "Running" ? " &" : "";
      return line(flags.has("l") ? `[${j.id}]${mark} ${j.pid} ${j.status.padEnd(24)}${j.command}${suffix}` : `[${j.id}]${mark}  ${j.status.padEnd(24)}${j.command}${suffix}`);
    }),
  );
};

const fg: CommandHandler = (args, ctx) => {
  const m = machine();
  const job = m.findJob(ctx.shell, args[0]);
  if (!job) return err(`bash: fg: ${args[0] ?? "current"}: no such job`);
  job.background = false;
  m.setForeground(ctx.tty, job.pid);
  if (job.status.startsWith("Stopped")) m.signal(job.pid, "CONT");
  return { kind: "foreground", pid: job.pid, lines: [line(job.command)] };
};

const bg: CommandHandler = (args, ctx) => {
  const m = machine();
  const job = m.findJob(ctx.shell, args[0]);
  if (!job) return err(`bash: bg: ${args[0] ?? "current"}: no such job`);
  if (!job.status.startsWith("Stopped")) return err(`bash: bg: job ${job.id} already in background`);
  job.background = true;
  m.signal(job.pid, "CONT");
  return out(line(`[${job.id}]${m.jobMark(ctx.shell, job)} ${job.command} &`));
};

/* ------------------------------------------------------------ programas -- */

/** 300, 5s, 2m, 1.5h… (como GNU sleep). */
function parseDuration(spec: string): number | null {
  const m = spec.match(/^(\d+(?:\.\d+)?)([smhd]?)$/);
  if (!m) return null;
  const unit = { "": 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2] as "" | "s" | "m" | "h" | "d"];
  return Number(m[1]) * unit * 1000;
}

const sleep: CommandHandler = (args, ctx, parsed) => {
  if (!args.length) return out(line("sleep: missing operand", "error"), line("Try 'sleep --help' for more information."));
  let total = 0;
  for (const a of args) {
    const ms = parseDuration(a);
    if (ms === null) return out(line(`sleep: invalid time interval ‘${a}’`, "error"), line("Try 'sleep --help' for more information."));
    total += ms;
  }
  const pid = machine().spawn({ ppid: ctx.shell, comm: "sleep", cmd: parsed.raw, tty: ctx.tty, kind: "sleep", duration: total });
  return { kind: "process", pid, lines: [] };
};

/** ./zombie: el hijo termina enseguida y el padre no hace wait() durante 60 s. */
export function runZombie(ctx: CommandContext, command: string) {
  const m = machine();
  const parent = m.spawn({ ppid: ctx.shell, comm: "zombie", cmd: command, tty: ctx.tty, kind: "zombie", duration: 60_000, reaps: false, vsz: 2552, rss: 1024 });
  const child = m.spawn({ ppid: parent, comm: "zombie", cmd: command, tty: ctx.tty, kind: "program", duration: 800, vsz: 2552, rss: 512 });
  return {
    kind: "process" as const,
    pid: parent,
    lines: [
      line(`Padre (PID ${parent}): creé al hijo ${child} y no llamaré a wait() durante 60 s`),
      line(`Hijo  (PID ${child}): termino ya; mi padre no me recoge → quedo como zombi (Z)`),
    ],
  };
}

/* ---------------------------------------------------------- shells ----- */

const bash: CommandHandler = (args, ctx) => {
  if (args.length) return err(`bash: ${args[0]}: No such file or directory`);
  machine().pushShell(ctx.tty);
  return out();
};

const exitCmd: CommandHandler = (_, ctx) => {
  const m = machine();
  const result = m.exitShell(ctx.tty, m.consumeExitWarning(ctx.shell));
  if (result === "stopped-jobs") return out(line("There are stopped jobs."));
  if (result === "exited") return out(line("exit"));
  return {
    kind: "stream",
    steps: [
      { delay: 0, lines: [line("logout")] },
      { delay: 700, clear: true, lines: bannerLines(ctx.tty) },
    ],
  };
};

/* ------------------------------------------------------ búsqueda -------- */

const pgrep: CommandHandler = (args, ctx) => {
  const { flags, operands } = splitFlags(args);
  const pattern = operands[0];
  if (!pattern) return out(line("pgrep: no matching criteria specified", "error"), line("Try `pgrep --help' for more information."));
  const self = ctx.transients[0]?.pid;
  const found = view(ctx).filter((p) => p.pid !== self && p.comm.includes(pattern));
  return out(...found.map((p) => line(flags.has("l") ? `${p.pid} ${p.comm}` : String(p.pid))));
};

const pidof: CommandHandler = (args, ctx) => {
  const found = view(ctx)
    .filter((p) => args.includes(p.comm))
    .map((p) => p.pid)
    .sort((a, b) => b - a);
  return found.length ? out(line(found.join(" "))) : out();
};

export const processCommands: Record<string, CommandHandler> = {
  ps,
  pstree: pstreeCmd,
  kill,
  jobs,
  fg,
  bg,
  sleep,
  bash,
  exit: exitCmd,
  logout: exitCmd,
  pgrep,
  pidof,
};

/** Mensaje de bash cuando un trabajo en primer plano muere por una señal (INT no imprime nada). */
export const foregroundDeathMessage = (signal: keyof typeof SIGNAL_MESSAGES | null) => (signal && signal !== "INT" ? SIGNAL_MESSAGES[signal] : null);
