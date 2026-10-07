import type { PhilosopherState, SimulationMode } from "./types";

export const PHILOSOPHER_COUNT = 5;
/** Semáforo de la sala: N − 1 procesos pueden competir a la vez. */
export const SEATS = PHILOSOPHER_COUNT - 1;

/** Duración base de un tick a velocidad 1×. */
export const TICK_MS = 650;
export const THINK_RANGE: [number, number] = [2, 6];
export const EAT_RANGE: [number, number] = [1, 3];
/** Ticks entre tomar el primer tenedor y solicitar el segundo. */
export const HOLD_DELAY_RANGE: [number, number] = [0, 4];
export const EVENT_LIMIT = 80;
export const DEFAULT_SEED = 6;

export const SPEEDS = [0.5, 1, 2] as const;

export const COLORS = {
  bg: "#05070B",
  bg1: "#080B12",
  bg2: "#0B1017",
  bg3: "#0E141D",
  ink: "#F5F7FA",
  ink2: "#A5AFBC",
  ink3: "#687384",
  line: "#27303D",
  blue: "#3B82F6",
  blue2: "#60A5FA",
  red: "#FF5A5F",
} as const;

export interface SectionMeta {
  id: string;
  index: string;
  label: string;
}

export const SECTIONS: SectionMeta[] = [
  { id: "inicio", index: "01", label: "Inicio" },
  { id: "contexto", index: "02", label: "Contexto" },
  { id: "recurso", index: "03", label: "Recurso compartido" },
  { id: "modelo", index: "04", label: "Modelo" },
  { id: "conflicto", index: "05", label: "Conflicto" },
  { id: "condiciones", index: "06", label: "Condiciones" },
  { id: "secuencia", index: "07", label: "Secuencia" },
  { id: "simulacion", index: "08", label: "Simulación" },
  { id: "soluciones", index: "09", label: "Soluciones" },
  { id: "comparacion", index: "10", label: "Comparación" },
  { id: "conclusion", index: "11", label: "Conclusión" },
  { id: "equipo", index: "12", label: "Equipo" },
];

export const NAV_LINKS: { href: string; label: string; sections: string[] }[] = [
  { href: "#contexto", label: "Contexto", sections: ["contexto", "recurso"] },
  { href: "#modelo", label: "Modelo", sections: ["modelo"] },
  { href: "#conflicto", label: "Conflicto", sections: ["conflicto"] },
  { href: "#condiciones", label: "Condiciones", sections: ["condiciones", "secuencia"] },
  { href: "#simulacion", label: "Simulación", sections: ["simulacion"] },
  { href: "#soluciones", label: "Soluciones", sections: ["soluciones", "comparacion"] },
];

export const STATE_META: Record<PhilosopherState, { label: string; description: string }> = {
  thinking: { label: "thinking", description: "Piensa. No usa recursos." },
  hungry: { label: "hungry", description: "Necesita comer. Va a solicitar tenedores." },
  holding: { label: "holding", description: "Retiene un tenedor." },
  waiting: { label: "waiting", description: "Espera un recurso ocupado." },
  eating: { label: "eating", description: "Tiene ambos tenedores. Sección crítica." },
  blocked: { label: "blocked", description: "Parte de un ciclo. No puede avanzar." },
};

export interface ModeMeta {
  id: SimulationMode;
  index: string;
  label: string;
  description: string;
}

export const MODES: ModeMeta[] = [
  {
    id: "normal",
    index: "00",
    label: "Normal",
    description: "Protocolo ingenuo con tiempos aleatorios. El deadlock depende del entrelazado.",
  },
  {
    id: "deadlock",
    index: "!",
    label: "Provocar deadlock",
    description: "Todos tienen hambre en el mismo instante y toman primero el tenedor izquierdo.",
  },
  {
    id: "ordered",
    index: "01",
    label: "Orden total",
    description: "Cada proceso solicita primero el tenedor de menor número.",
  },
  {
    id: "limited",
    index: "02",
    label: "Limitar concurrencia",
    description: "Un semáforo permite como máximo 4 procesos compitiendo a la vez.",
  },
  {
    id: "asymmetric",
    index: "03",
    label: "Asimétrica",
    description: "Pares: izquierdo → derecho. Impares: derecho → izquierdo.",
  },
  {
    id: "monitor",
    index: "04",
    label: "Dos o ninguno",
    description: "Un monitor entrega ambos tenedores a la vez; quien espera no retiene nada.",
  },
];
