import type { SimulationMode, SimulationState } from "@/lib/types";
import type { CommandResult, OutputLine, Span, Tone } from "@/types/terminal";
import type { Transient } from "./processes/processView";

export type { CommandResult, OutputLine, Span, Tone };

/** Puente controlado hacia el motor de los filósofos (sin acceso a nada más). */
export interface SimulationBridge {
  getState: () => SimulationState;
  isPlaying: () => boolean;
  replace: (state: SimulationState) => void;
  play: () => void;
  pause: () => void;
  step: () => void;
  reset: (mode?: SimulationMode) => void;
  speed: () => number;
  setSpeed: (speed: number) => void;
}

export interface CommandContext {
  cwd: string;
  history: readonly string[];
  sim: SimulationBridge;
  /** Momento de carga de la sesión (para uptime y fechas de ls -l). */
  sessionStart: number;
  /** Terminal de la sesión (pts/0, pts/1…). */
  tty: string;
  /** PID del bash que ejecuta el comando. */
  shell: number;
  /** La salida va a una tubería (ls imprime una entrada por línea, sin color). */
  piped: boolean;
  /** Procesos de la línea en curso (el propio comando y sus compañeros de tubería). */
  transients: Transient[];
}

export type SessionContext = Pick<CommandContext, "cwd" | "history" | "sim" | "sessionStart" | "tty">;

export interface ParsedCommand {
  raw: string;
  name: string;
  args: string[];
}

export type CommandHandler = (args: string[], ctx: CommandContext, parsed: ParsedCommand) => CommandResult;

/* Helpers para construir salidas. */
export const line = (text: string, tone?: Tone): OutputLine => ({ spans: [{ text, tone }] });
export const spans = (...parts: Span[]): OutputLine => ({ spans: parts });
export const lines = (text: string, tone?: Tone): OutputLine[] => text.split("\n").map((t) => line(t, tone));
export const out = (...ls: OutputLine[]): CommandResult => ({ kind: "output", lines: ls });
export const outText = (text: string, tone?: Tone): CommandResult => ({ kind: "output", lines: lines(text, tone) });
