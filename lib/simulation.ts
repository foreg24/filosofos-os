/**
 * Motor de simulación de los filósofos comensales.
 *
 * Funciones puras: cada tick recibe un estado y devuelve uno nuevo.
 * No depende de React ni de ningún componente visual.
 */
import {
  EAT_RANGE,
  EVENT_LIMIT,
  HOLD_DELAY_RANGE,
  PHILOSOPHER_COUNT,
  SEATS,
  THINK_RANGE,
} from "./constants";
import type {
  EventKind,
  Fork,
  ForkVisualState,
  Philosopher,
  SimulationEvent,
  SimulationMode,
  SimulationState,
  WaitEdge,
} from "./types";

const N = PHILOSOPHER_COUNT;

/* ---------------------------------------------------------------- rng -- */

/** mulberry32: generador determinista para que cada ejecución sea reproducible. */
function createRng(seed: number) {
  let s = seed | 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    seed: () => s,
  };
}

type Rng = ReturnType<typeof createRng>;

function shuffledIds(rng: Rng): number[] {
  const ids = Array.from({ length: N }, (_, i) => i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/* ------------------------------------------------------------ helpers -- */

export const leftForkOf = (id: number) => id;
export const rightForkOf = (id: number) => (id + 1) % N;

/** Orden en que cada estrategia solicita los dos tenedores. */
export function acquisitionOrder(p: Philosopher, mode: SimulationMode): [number, number] {
  const { leftFork: l, rightFork: r } = p;
  if (mode === "ordered") return [Math.min(l, r), Math.max(l, r)];
  if (mode === "asymmetric") return p.id % 2 === 0 ? [l, r] : [r, l];
  return [l, r];
}

export const isSolutionMode = (mode: SimulationMode) =>
  mode === "ordered" || mode === "limited" || mode === "asymmetric" || mode === "monitor";

/** En "deadlock" y en las soluciones todos despiertan en el mismo tick: el peor entrelazado. */
const synchronizedStart = (mode: SimulationMode) => mode !== "normal";

export function formatCycle(cycle: number[]): string {
  return [...cycle, cycle[0]].map((id) => `P${id}`).join(" → ");
}

/* ------------------------------------------------------------ factory -- */

export function createSimulation(mode: SimulationMode, seed = 1): SimulationState {
  const rng = createRng(seed);
  const philosophers: Philosopher[] = Array.from({ length: N }, (_, id) => ({
    id,
    state: "thinking",
    leftFork: leftForkOf(id),
    rightFork: rightForkOf(id),
    timer: synchronizedStart(mode) ? 1 : rng.int(...THINK_RANGE),
    meals: 0,
    waitingFor: null,
    hasSeat: false,
  }));
  const forks: Fork[] = Array.from({ length: N }, (_, id) => ({ id, heldBy: null }));

  return {
    philosophers,
    forks,
    status: "idle",
    mode,
    tick: 0,
    seed: rng.seed(),
    seats: SEATS,
    cycle: null,
    events: [],
    eventSeq: 0,
  };
}

/* --------------------------------------------------------------- step -- */

/**
 * Avanza un tick. Cada filósofo realiza como máximo una transición,
 * en un orden aleatorio que simula el entrelazado del planificador.
 */
export function step(state: SimulationState): SimulationState {
  if (state.status === "deadlock") return state;

  const rng = createRng(state.seed);
  const philosophers = state.philosophers.map((p) => ({ ...p }));
  const forks = state.forks.map((f) => ({ ...f }));
  const tick = state.tick + 1;
  const { mode } = state;
  let seats = state.seats;
  let seq = state.eventSeq;
  const events: SimulationEvent[] = [];
  const log = (kind: EventKind, text: string) => events.push({ id: ++seq, tick, kind, text });

  const tryAcquire = (p: Philosopher) => {
    if (mode === "limited" && !p.hasSeat) {
      if (seats > 0) {
        seats -= 1;
        p.hasSeat = true;
        p.state = "hungry";
        p.waitingFor = null;
        log("info", `P${p.id} entra a la sala · ${SEATS - seats}/${SEATS}`);
      } else if (p.state !== "waiting") {
        p.state = "waiting";
        p.waitingFor = null;
        log("wait", `P${p.id} espera turno · sala llena`);
      }
      return;
    }

    // Monitor: los dos tenedores en una sola operación atómica, o ninguno. Quien espera no retiene nada.
    if (mode === "monitor") {
      const left = forks[p.leftFork];
      const right = forks[p.rightFork];
      if (left.heldBy === null && right.heldBy === null) {
        left.heldBy = p.id;
        right.heldBy = p.id;
        p.state = "eating";
        p.waitingFor = null;
        p.timer = rng.int(...EAT_RANGE);
        log("acquire", `P${p.id} toma F${p.leftFork} y F${p.rightFork} a la vez · come`);
      } else if (p.state !== "waiting") {
        const busy = left.heldBy !== null ? left.heldBy : right.heldBy;
        p.state = "waiting";
        p.waitingFor = null;
        log("wait", `P${p.id} espera sin tomar nada · P${busy} está comiendo`);
      }
      return;
    }

    const [first, second] = acquisitionOrder(p, mode);
    const target = forks[first].heldBy === p.id ? second : first;
    const fork = forks[target];

    if (fork.heldBy === null) {
      fork.heldBy = p.id;
      p.waitingFor = null;
      if (forks[first].heldBy === p.id && forks[second].heldBy === p.id) {
        p.state = "eating";
        p.timer = rng.int(...EAT_RANGE);
        log("acquire", `P${p.id} toma F${target} · come`);
      } else {
        p.state = "holding";
        // Latencia entre la primera y la segunda adquisición: la ventana donde nace el ciclo.
        p.timer = mode === "deadlock" ? 0 : rng.int(...HOLD_DELAY_RANGE);
        log("acquire", `P${p.id} toma F${target}`);
      }
    } else if (p.state !== "waiting" || p.waitingFor !== target) {
      p.state = "waiting";
      p.waitingFor = target;
      log("wait", `P${p.id} espera F${target} · retenido por P${fork.heldBy}`);
    }
  };

  for (const id of shuffledIds(rng)) {
    const p = philosophers[id];
    switch (p.state) {
      case "thinking":
        p.timer -= 1;
        if (p.timer <= 0) {
          p.state = "hungry";
          log("info", `P${id} tiene hambre`);
        }
        break;
      case "eating":
        p.timer -= 1;
        if (p.timer <= 0) {
          forks[p.leftFork].heldBy = null;
          forks[p.rightFork].heldBy = null;
          p.meals += 1;
          p.state = "thinking";
          p.timer = rng.int(...THINK_RANGE);
          if (p.hasSeat) {
            p.hasSeat = false;
            seats += 1;
          }
          log("release", `P${id} libera F${p.leftFork} y F${p.rightFork}`);
        }
        break;
      case "holding":
        if (p.timer > 0) p.timer -= 1;
        else tryAcquire(p);
        break;
      case "hungry":
      case "waiting":
        tryAcquire(p);
        break;
      case "blocked":
        break;
    }
  }

  let status = state.status === "idle" ? "running" : state.status;
  if (status === "running" && isSolutionMode(mode) && philosophers.every((p) => p.meals > 0)) {
    status = "resolved";
    log("ok", "Los 5 procesos completaron su sección crítica · sin ciclo");
  }

  return {
    ...state,
    philosophers,
    forks,
    seats,
    tick,
    seed: rng.seed(),
    status,
    events: [...state.events, ...events].slice(-EVENT_LIMIT),
    eventSeq: seq,
  };
}

/* ---------------------------------------------------------- detection -- */

/** Grafo de espera: Pi → Pj si Pi solicita un tenedor que Pj retiene. */
export function waitForGraph(state: Pick<SimulationState, "philosophers" | "forks">): WaitEdge[] {
  return state.philosophers.flatMap((p) => {
    if ((p.state !== "waiting" && p.state !== "blocked") || p.waitingFor === null) return [];
    const holder = state.forks[p.waitingFor].heldBy;
    return holder === null || holder === p.id ? [] : [{ from: p.id, to: holder, fork: p.waitingFor }];
  });
}

/** Cada proceso espera como máximo a otro: basta con seguir la cadena. */
export function findCycle(edges: WaitEdge[]): number[] | null {
  const next = new Map(edges.map((e) => [e.from, e.to]));
  for (const start of next.keys()) {
    const position = new Map<number, number>();
    const path: number[] = [];
    let node: number | undefined = start;
    while (node !== undefined && !position.has(node)) {
      position.set(node, path.length);
      path.push(node);
      node = next.get(node);
    }
    if (node !== undefined) {
      const cycle = path.slice(position.get(node));
      const min = cycle.indexOf(Math.min(...cycle));
      return [...cycle.slice(min), ...cycle.slice(0, min)];
    }
  }
  return null;
}

export function detectDeadlock(state: SimulationState): SimulationState {
  if (state.status === "deadlock") return state;
  const cycle = findCycle(waitForGraph(state));
  if (!cycle) return state;

  const members = new Set(cycle);
  let seq = state.eventSeq;
  const tick = state.tick;
  const events: SimulationEvent[] = [
    { id: ++seq, tick, kind: "alert", text: `Ciclo detectado: ${formatCycle(cycle)}` },
    { id: ++seq, tick, kind: "alert", text: "DEADLOCK · ningún proceso puede continuar" },
  ];

  return {
    ...state,
    philosophers: state.philosophers.map((p) =>
      members.has(p.id) ? { ...p, state: "blocked" } : p,
    ),
    status: "deadlock",
    cycle,
    events: [...state.events, ...events].slice(-EVENT_LIMIT),
    eventSeq: seq,
  };
}

/**
 * Un tick completo del sistema: primero el detector revisa el grafo de espera
 * (como lo haría un sistema operativo de forma periódica) y después avanza.
 */
export function advance(state: SimulationState): SimulationState {
  const checked = detectDeadlock(state);
  return checked.status === "deadlock" ? checked : step(checked);
}

/* --------------------------------------------------------- derivation -- */

export function forkVisualState(
  fork: Fork,
  state: Pick<SimulationState, "philosophers" | "cycle">,
): ForkVisualState {
  if (fork.heldBy === null) return "available";
  if (state.cycle && state.cycle.includes(fork.heldBy)) return "blocked";
  const contended = state.philosophers.some(
    (p) => p.waitingFor === fork.id && p.id !== fork.heldBy,
  );
  return contended ? "requested" : "held";
}

export function heldForks(state: Pick<SimulationState, "forks">, id: number): number[] {
  return state.forks.filter((f) => f.heldBy === id).map((f) => f.id);
}

export function totalMeals(state: SimulationState): number {
  return state.philosophers.reduce((sum, p) => sum + p.meals, 0);
}

/**
 * Instantáneas reales del motor para la narrativa por scroll:
 * piensan → hambre → retienen uno → esperan → bloqueo.
 */
export function deadlockStorySnapshots(): SimulationState[] {
  const s0 = createSimulation("deadlock", 1);
  const s1 = step(s0);
  const s2 = step(s1);
  const s3 = step(s2);
  const s4 = detectDeadlock(s3);
  return [s0, s1, s2, s3, s4];
}
