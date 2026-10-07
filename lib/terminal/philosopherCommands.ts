/**
 * Comandos de filosofos.py conectados al motor de los filósofos comensales: philosophers, forks,
 * simulation, deadlock, watch, log y reset. Muestran los mismos PIDs y estados del kernel que
 * ps, pstree y /proc (processes/tableProcesses), y avanzan el mismo estado que ve el panel.
 */
import { MODES, TICK_MS } from "@/lib/constants";
import { advance, createSimulation, formatCycle, heldForks, totalMeals, waitForGraph } from "@/lib/simulation";
import type { PhilosopherState, SimulationEvent, SimulationMode, SimulationState } from "@/lib/types";
import type { OutputLine, StreamStep, Tone } from "@/types/terminal";
import { PHILOSOPHER_PIDS, philosopherKernel, tableActive } from "./processes/tableProcesses";
import { type CommandContext, type CommandHandler, type SimulationBridge, line, out, spans } from "./terminalTypes";

const MODE_INFO: Record<SimulationMode, string> = {
  normal: "naive protocol, random timing",
  deadlock: "naive protocol, synchronized start",
  ordered: "total order of resources",
  limited: "N-1 semaphore",
  asymmetric: "asymmetric acquisition",
  monitor: "both forks or none, monitor",
};
const MODE_IDS = MODES.map((m) => m.id);
const SEATS = 4;
const KERNEL_STATES: Record<string, string> = { R: "running", S: "sleeping", T: "stopped" };

type Shown = PhilosopherState | "stopped";
const STATE_TONE: Record<Shown, Tone | undefined> = {
  thinking: "muted",
  hungry: undefined,
  holding: "info",
  waiting: "warn",
  eating: "strong",
  blocked: "alert",
  stopped: "warn",
};

const pad = (s: string, n: number) => s.padEnd(n);
const pids = () => PHILOSOPHER_PIDS.join(" ");
const paused = (sim: SimulationBridge) => sim.getState().status !== "deadlock" && sim.getState().status !== "idle" && !sim.isPlaying();

/* ---------------------------------------------------------------- tablas -- */

function philosopherRows(sim: SimulationBridge): OutputLine[] {
  const s = sim.getState();
  const alive = tableActive();
  const rows = s.philosophers.map((p) => {
    const shown: Shown = alive && paused(sim) && p.state !== "blocked" ? "stopped" : p.state;
    const held = heldForks(s, p.id).map((f) => `F${f}`).join(",") || "—";
    const holder = p.waitingFor !== null ? s.forks[p.waitingFor].heldBy : null;
    let waits = "—";
    if (p.waitingFor !== null) waits = `F${p.waitingFor}${holder !== null ? ` (P${holder})` : ""}`;
    else if (p.state === "waiting") waits = s.mode === "monitor" ? "vecinos (monitor)" : "turno de sala";
    let kernel = "—";
    if (alive) {
      const k = philosopherKernel(p.id);
      kernel = `${k.state} ${KERNEL_STATES[k.state] ?? ""}${k.wchan !== "-" ? ` · ${k.wchan}` : ""}`;
    }
    return spans(
      { text: pad(`P${p.id}`, 6) },
      { text: pad(alive ? String(PHILOSOPHER_PIDS[p.id]) : "—", 8) },
      { text: pad(shown.toUpperCase(), 11), tone: STATE_TONE[shown] },
      { text: pad(held, 9) + pad(waits, 17) + kernel, tone: "muted" },
    );
  });
  return [
    line(`${pad("PROC", 6)}${pad("PID", 8)}${pad("STATE", 11)}${pad("HOLDS", 9)}${pad("WAITS FOR", 17)}KERNEL (/proc)`, "strong"),
    ...rows,
    ...(alive ? [] : [line("Sin procesos en ejecución. Usa 'simulation start' o 'deadlock'.", "muted")]),
  ];
}

function forkRows(sim: SimulationBridge): OutputLine[] {
  const s = sim.getState();
  return [
    line(`${pad("FORK", 6)}${pad("STATE", 9)}${pad("HOLDER", 8)}REQUESTED BY`, "strong"),
    ...s.forks.map((f) => {
      const waiting = s.philosophers.filter((p) => p.waitingFor === f.id).map((p) => `P${p.id}`).join(",") || "—";
      const blocked = s.status === "deadlock" && f.heldBy !== null;
      return spans(
        { text: pad(`F${f.id}`, 6) },
        { text: pad(f.heldBy === null ? "FREE" : blocked ? "BLOCKED" : "HELD", 9), tone: f.heldBy === null ? "muted" : blocked ? "alert" : "info" },
        { text: pad(f.heldBy === null ? "—" : `P${f.heldBy}`, 8) + waiting, tone: "muted" },
      );
    }),
  ];
}

function statusLines(sim: SimulationBridge): OutputLine[] {
  const s = sim.getState();
  const alive = tableActive();
  const waits = waitForGraph(s);
  const statusTone: Tone = s.status === "deadlock" ? "alert" : s.status === "running" || s.status === "resolved" ? "info" : "default";
  const status = paused(sim) ? "RUNNING (paused · SIGSTOP)" : s.status.toUpperCase();
  const seats = s.philosophers.filter((p) => p.hasSeat).length;
  return [
    line("Dining philosophers · Linux processes", "strong"),
    spans({ text: "  status   " }, { text: status, tone: statusTone }),
    line(`  mode     ${s.mode} (${MODE_INFO[s.mode]})`),
    line(`  speed    ${sim.speed()}x`),
    line(`  uptime   ${alive ? `${((s.tick * TICK_MS) / 1000).toFixed(1)} s` : "—"}`),
    line(`  meals    ${totalMeals(s)}`),
    line(`  waits    ${waits.length ? waits.map((e) => `P${e.from}→P${e.to}`).join("  ") : "none"}`),
    ...(s.mode === "limited" ? [line(`  sala     ${seats}/${SEATS}`)] : []),
    ...(s.cycle ? [line(`  cycle    ${formatCycle(s.cycle)}`, "alert")] : []),
    line(`  pids     ${alive ? pids() : "—"}`),
  ];
}

const EVENT_TONE: Record<SimulationEvent["kind"], Tone> = { info: "muted", acquire: "info", wait: "warn", release: "muted", alert: "alert", ok: "info" };

function eventLine(e: SimulationEvent): OutputLine {
  const t = ((e.tick * TICK_MS) / 1000).toFixed(2).padStart(6);
  return spans({ text: `  t=${t}s  `, tone: "muted" }, { text: e.text, tone: EVENT_TONE[e.kind] });
}

/* -------------------------------------------------------------- comandos -- */

const philosophers: CommandHandler = (_, ctx) => out(...philosopherRows(ctx.sim));
const forks: CommandHandler = (_, ctx) => out(...forkRows(ctx.sim));

const simulation: CommandHandler = (args, ctx) => {
  const [sub, value] = args;
  const { sim } = ctx;
  const s = sim.getState();
  if (!sub) {
    return out(
      ...statusLines(sim),
      line(""),
      line(`Usage: simulation [start|pause|resume|stop|step|mode <${MODE_IDS.join("|")}>|speed <0.5|1|2>]`, "muted"),
    );
  }
  if (sub === "start") {
    if (s.status === "deadlock") return out(line("simulation: system is deadlocked. Run 'reset' first.", "warn"));
    if (sim.isPlaying()) return out(line("simulation: already running."));
    sim.play();
    return out(line(`Simulation running · mode ${s.mode} · PIDs ${pids()}`, "info"));
  }
  if (sub === "pause") {
    if (!tableActive()) return out(line("simulation: not running."));
    sim.pause();
    return out(line("Simulation paused · SIGSTOP enviado a los 5 procesos (estado T en ps)."));
  }
  if (sub === "resume" || sub === "continue") {
    if (s.status === "running" || s.status === "resolved") sim.play();
    return out(line("Simulation resumed · SIGCONT."));
  }
  if (sub === "stop") {
    sim.reset(s.mode);
    return out(line("Simulation stopped · procesos terminados."));
  }
  if (sub === "step") {
    sim.step();
    return out(line("Advanced one tick."));
  }
  if (sub === "mode") {
    if (!value || !MODE_IDS.includes(value as SimulationMode)) return out(line(`simulation: mode must be one of: ${MODE_IDS.join(", ")}`, "error"));
    sim.reset(value as SimulationMode);
    return out(line(`Mode set to ${value} (${MODE_INFO[value as SimulationMode]}). 5 processes THINKING.`));
  }
  if (sub === "speed") {
    const speed = Number(value);
    if (!value || !Number.isFinite(speed) || speed <= 0) return out(line("Usage: simulation speed <0.5|1|2>"));
    sim.setSpeed(Math.min(4, Math.max(0.25, speed)));
    return out(line(`Speed ${sim.speed()}x.`));
  }
  return out(line(`simulation: unknown subcommand '${sub}'`, "error"));
};

const reset: CommandHandler = (_, ctx) => {
  const mode = ctx.sim.getState().mode;
  ctx.sim.reset(mode);
  return out(line(`Simulation reset · mode ${mode} · 5 processes THINKING · 5 forks FREE`));
};

/** Una línea de traza por fotograma, derivada del estado del motor. */
function describe(s: SimulationState): OutputLine {
  const tick = `  t=${String(s.tick).padStart(3, "0")}  `;
  const waits = waitForGraph(s);
  if (s.philosophers.every((p) => p.state === "hungry")) return line(`${tick}P0 P1 P2 P3 P4 → HUNGRY`, "muted");
  if (waits.length) return line(`${tick}${waits.map((e) => `P${e.from}→F${e.fork}`).join("  ")}   request: right fork held by neighbour`, "muted");
  const holds = s.forks.filter((f) => f.heldBy !== null).map((f) => `F${f.id}→P${f.heldBy}`);
  return line(`${tick}${holds.join("  ")}   assignment: each holds its left fork`, "muted");
}

/** Lo que muestra filosofos.py al formarse el ciclo: los cinco procesos dormidos en el kernel. */
function evidence(): OutputLine[] {
  return [
    line("Evidencia del kernel (/proc/PID/stat y /proc/PID/wchan)", "strong"),
    line(`  ${pad("PID", 8)}${pad("STAT", 6)}${pad("WCHAN", 24)}COMMAND`, "strong"),
    ...PHILOSOPHER_PIDS.map((pid, i) => line(`  ${pad(String(pid), 8)}${pad("S", 6)}${pad("futex_wait_queue", 24)}filosofo-P${i}`)),
    line(""),
    line("All 5 processes hold one fork and wait for the next. None can proceed.", "muted"),
    line("Siguen vivos, pero dormidos (S) en el kernel esperando un semáforo que nadie va a liberar.", "muted"),
    line("Compruébalo:  ps -o pid,stat,wchan:22,comm -p $FILOSOFOS    o    pstree -p $MESA", "muted"),
    line("Run 'reset' to restart the simulation.", "muted"),
  ];
}

const deadlock: CommandHandler = (_, ctx) => {
  const frames: SimulationState[] = [createSimulation("deadlock", 1)];
  while (frames[frames.length - 1].status !== "deadlock" && frames.length < 12) frames.push(advance(frames[frames.length - 1]));
  const final = frames[frames.length - 1];
  const middle = frames.slice(1, -1);

  const steps: StreamStep[] = [
    {
      delay: 0,
      effect: () => {
        ctx.sim.pause();
        ctx.sim.replace(frames[0]);
      },
      lines: [line(""), { spans: [{ text: "Analyzing resource graph...", tone: "strong" }, { text: `  (PIDs ${pids()})`, tone: "muted" }], typewriter: true }],
    },
    ...middle.map((frame, i) => ({ delay: i === 0 ? 900 : 650, effect: () => ctx.sim.replace(frame), lines: [describe(frame)] })),
    {
      delay: 750,
      effect: () => ctx.sim.replace(final),
      lines: [line(""), line("Circular wait detected."), line(final.cycle ? formatCycle(final.cycle) : "", "alert"), line("")],
    },
    { delay: 500, lines: [{ spans: [{ text: "DEADLOCK DETECTED", tone: "alert" }], typewriter: true }, line("")] },
    { delay: 900, lines: evidence() },
  ];
  return { kind: "stream", steps };
};

/** Tablero en vivo cada 0.5 s hasta Ctrl+C (como el `watch` de filosofos.py). */
const watch: CommandHandler = (_, ctx: CommandContext) => {
  if (!tableActive()) return out(line("watch: no hay procesos. Usa 'simulation start' o 'deadlock' primero."));
  const frame = (): OutputLine[] => [
    line("watch · cada 0.5 s · Ctrl+C para salir", "muted"),
    line(""),
    ...statusLines(ctx.sim),
    line(""),
    ...philosopherRows(ctx.sim),
    line(""),
    ...forkRows(ctx.sim),
    line(""),
    line("Últimos eventos", "strong"),
    ...ctx.sim.getState().events.slice(-8).map(eventLine),
  ];
  const steps: StreamStep[] = Array.from({ length: 1200 }, (_, i) => ({ delay: i === 0 ? 0 : 500, clear: true, render: frame }));
  return { kind: "stream", steps };
};

const log: CommandHandler = (args, ctx) => {
  const count = /^\d+$/.test(args[0] ?? "") ? Number(args[0]) : 30;
  const events = ctx.sim.getState().events.slice(-count);
  return events.length ? out(...events.map(eventLine)) : out(line("Sin eventos todavía."));
};

export const philosopherCommands: Record<string, CommandHandler> = {
  philosophers,
  forks,
  simulation,
  deadlock,
  watch,
  log,
  reset,
};
