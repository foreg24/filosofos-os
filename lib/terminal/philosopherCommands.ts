/**
 * Comandos de la exposición conectados al motor real de los filósofos comensales.
 * `deadlock` no dibuja nada por su cuenta: avanza el mismo estado que ve el panel visual.
 */
import { MODES } from "@/lib/constants";
import { advance, createSimulation, formatCycle, heldForks, totalMeals, waitForGraph } from "@/lib/simulation";
import type { PhilosopherState, SimulationMode, SimulationState } from "@/lib/types";
import type { OutputLine, StreamStep, Tone } from "@/types/terminal";
import { type CommandHandler, line, out, spans } from "./terminalTypes";

const MODE_INFO: Record<SimulationMode, string> = {
  normal: "naive protocol, random timing",
  deadlock: "naive protocol, synchronized start",
  ordered: "total order of resources",
  limited: "N-1 semaphore",
  asymmetric: "asymmetric acquisition",
  monitor: "both forks or none (monitor)",
};
const MODE_IDS = MODES.map((m) => m.id);

const STATE_TONE: Record<PhilosopherState, Tone | undefined> = {
  thinking: "muted",
  hungry: undefined,
  holding: "info",
  waiting: "info",
  eating: "strong",
  blocked: "alert",
};

const pad = (s: string, n: number) => s.padEnd(n);

const philosophers: CommandHandler = (_, ctx) => {
  const s = ctx.sim.getState();
  return out(
    line(`${pad("PROC", 6)}${pad("STATE", 11)}${pad("HOLDS", 9)}WAITS FOR`, "strong"),
    ...s.philosophers.map((p) => {
      const held = heldForks(s, p.id).map((f) => `F${f}`).join(",") || "—";
      const holder = p.waitingFor !== null ? s.forks[p.waitingFor].heldBy : null;
      const waits = p.waitingFor !== null ? `F${p.waitingFor}${holder !== null ? ` (P${holder})` : ""}` : p.state === "waiting" ? "turn" : "—";
      return spans({ text: pad(`P${p.id}`, 6) }, { text: pad(p.state.toUpperCase(), 11), tone: STATE_TONE[p.state] }, { text: pad(held, 9) + waits, tone: "muted" });
    }),
  );
};

const forks: CommandHandler = (_, ctx) => {
  const s = ctx.sim.getState();
  return out(
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
  );
};

function statusLines(s: SimulationState, playing: boolean): OutputLine[] {
  const waits = waitForGraph(s);
  const statusTone: Tone = s.status === "deadlock" ? "alert" : s.status === "resolved" ? "info" : "default";
  const status = s.status === "running" && !playing ? "RUNNING (paused)" : s.status.toUpperCase();
  return [
    line("Dining philosophers · simulation engine", "strong"),
    spans({ text: "  status   " }, { text: status, tone: statusTone }),
    line(`  mode     ${s.mode} (${MODE_INFO[s.mode]})`),
    line(`  tick     ${String(s.tick).padStart(3, "0")}`),
    line(`  meals    ${totalMeals(s)}`),
    line(`  waits    ${waits.length ? waits.map((e) => `P${e.from}→P${e.to}`).join("  ") : "none"}`),
    ...(s.cycle ? [line(`  cycle    ${formatCycle(s.cycle)}`, "alert")] : []),
  ];
}

const simulation: CommandHandler = (args, ctx) => {
  const [sub, value] = args;
  const { sim } = ctx;
  if (!sub) return out(...statusLines(sim.getState(), sim.isPlaying()), line(""), line("Usage: simulation [start|pause|step|mode <" + MODE_IDS.join("|") + ">]", "muted"));
  if (sub === "start") {
    if (sim.getState().status === "deadlock") return out(line("simulation: system is deadlocked. Run 'reset' first.", "warn"));
    sim.play();
    return out(line(`Simulation running · mode ${sim.getState().mode}`, "info"));
  }
  if (sub === "pause") {
    sim.pause();
    return out(line("Simulation paused."));
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
  return out(line(`simulation: unknown subcommand '${sub}'`, "error"));
};

const reset: CommandHandler = (_, ctx) => {
  const mode = ctx.sim.getState().mode;
  ctx.sim.reset(mode);
  return out(line(`Simulation reset · mode ${mode} · 5 processes THINKING · 5 forks FREE`));
};

/** Una línea de traza por fotograma, derivada del estado real del motor. */
function describe(s: SimulationState): OutputLine {
  const tick = `  t=${String(s.tick).padStart(3, "0")}  `;
  const waits = waitForGraph(s);
  if (s.philosophers.every((p) => p.state === "hungry")) return line(`${tick}P0 P1 P2 P3 P4 → HUNGRY`, "muted");
  if (waits.length) return line(`${tick}${waits.map((e) => `P${e.from}→F${e.fork}`).join("  ")}   request: right fork held by neighbour`, "muted");
  const holds = s.forks.filter((f) => f.heldBy !== null).map((f) => `F${f.id}→P${f.heldBy}`);
  return line(`${tick}${holds.join("  ")}   assignment: each holds its left fork`, "muted");
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
      lines: [line(""), { spans: [{ text: "Analyzing resource graph...", tone: "strong" }], typewriter: true }],
    },
    ...middle.map((frame, i) => ({ delay: i === 0 ? 900 : 650, effect: () => ctx.sim.replace(frame), lines: [describe(frame)] })),
    {
      delay: 750,
      effect: () => ctx.sim.replace(final),
      lines: [line(""), line("Circular wait detected."), line(final.cycle ? formatCycle(final.cycle) : "", "alert"), line("")],
    },
    { delay: 500, lines: [{ spans: [{ text: "DEADLOCK DETECTED", tone: "alert" }], typewriter: true }] },
    {
      delay: 900,
      lines: [line(""), line("All 5 processes hold one fork and wait for the next. None can proceed.", "muted"), line("Run 'reset' to restart the simulation.", "muted")],
    },
  ];
  return { kind: "stream", steps };
};

export const philosopherCommands: Record<string, CommandHandler> = {
  philosophers,
  forks,
  simulation,
  deadlock,
  reset,
};
