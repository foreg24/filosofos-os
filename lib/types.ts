export type PhilosopherState =
  | "thinking"
  | "hungry"
  | "holding"
  | "waiting"
  | "eating"
  | "blocked";

export interface Philosopher {
  id: number;
  state: PhilosopherState;
  leftFork: number;
  rightFork: number;
  /** Ticks restantes en el estado actual (thinking / eating). */
  timer: number;
  /** Veces que ha completado la sección crítica. */
  meals: number;
  /** Tenedor solicitado y todavía no concedido. */
  waitingFor: number | null;
  /** Solo en el modo "limited": posee un turno del semáforo de la sala. */
  hasSeat: boolean;
}

export interface Fork {
  id: number;
  heldBy: number | null;
}

export type SimulationStatus = "idle" | "running" | "deadlock" | "resolved";

export type SimulationMode =
  | "normal"
  | "deadlock"
  | "ordered"
  | "limited"
  | "asymmetric"
  | "monitor";

export type EventKind = "info" | "acquire" | "wait" | "release" | "alert" | "ok";

export interface SimulationEvent {
  id: number;
  tick: number;
  kind: EventKind;
  text: string;
}

export interface SimulationState {
  philosophers: Philosopher[];
  forks: Fork[];
  status: SimulationStatus;
  mode: SimulationMode;
  tick: number;
  seed: number;
  /** Turnos libres del semáforo de la sala (modo "limited"). */
  seats: number;
  /** Ciclo del grafo de espera, si existe: [P0, P1, …]. */
  cycle: number[] | null;
  events: SimulationEvent[];
  eventSeq: number;
}

/** Arista del grafo de espera: `from` espera un recurso retenido por `to`. */
export interface WaitEdge {
  from: number;
  to: number;
  fork: number;
}

export type ForkVisualState = "available" | "held" | "requested" | "blocked";

export type IndicatorState = "idle" | "running" | "waiting" | "resolved" | "deadlock";
