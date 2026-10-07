/** Tipos públicos de la terminal Debian (compartidos entre UI y lógica). */

export type Tone = "default" | "muted" | "info" | "dir" | "strong" | "prompt" | "accent" | "match" | "error" | "warn" | "alert";

export interface Span {
  text: string;
  tone?: Tone;
  /** Muestra de color (bloques de color de neofetch): el texto se pinta sobre este fondo. */
  swatch?: string;
  /** Logo de neofetch: se oculta cuando la terminal es demasiado estrecha para mostrarlo al lado. */
  logo?: boolean;
}

/** Una línea de salida: uno o varios fragmentos con su tono. */
export interface OutputLine {
  spans: Span[];
  /** Aparición carácter a carácter (solo mensajes importantes). */
  typewriter?: boolean;
}

export interface PromptInfo {
  user: string;
  host: string;
  /** Directorio para mostrar: "~", "~/Documents", "/etc"… */
  path: string;
}

export type TerminalEntry =
  | { id: number; kind: "command"; prompt: PromptInfo; input: string; interrupted?: boolean }
  | { id: number; kind: "output"; line: OutputLine };

/** Paso de una salida en curso (p. ej. `deadlock`): espera, efecto y líneas. */
export interface StreamStep {
  delay: number;
  effect?: () => void;
  lines?: OutputLine[];
  /** Líneas calculadas en el momento del paso (pantallas en vivo como `watch`). */
  render?: () => OutputLine[];
  clear?: boolean;
}

export type CommandResult =
  | { kind: "output"; lines: OutputLine[] }
  | { kind: "clear" }
  | { kind: "cd"; cwd: string }
  | { kind: "stream"; steps: StreamStep[] }
  /** Un programa arrancado por el comando (sleep, ./zombie…): el intérprete decide si va en primer o segundo plano. */
  | { kind: "process"; pid: number; lines: OutputLine[] }
  /** La terminal queda ocupada hasta que el proceso termine o se detenga (Ctrl+C / Ctrl+Z). */
  | { kind: "foreground"; pid: number; lines: OutputLine[] }
  | { kind: "password"; message: string };
