import type { SimulationMode } from "./types";

export const GLOSSARY = [
  { term: "Filósofo", maps: "Proceso", note: "Unidad que ejecuta y compite" },
  { term: "Tenedor", maps: "Recurso compartido", note: "Uso exclusivo, uno a la vez" },
  { term: "Comer", maps: "Sección crítica", note: "Requiere ambos recursos" },
  { term: "Pensar", maps: "Trabajo independiente", note: "No retiene recursos" },
];

export const SYSTEM_FIGURES = [
  { value: "5", label: "Filósofos", note: "Procesos concurrentes P0 – P4" },
  { value: "5", label: "Tenedores", note: "Recursos compartidos F0 – F4" },
  { value: "2", label: "Recursos por proceso", note: "Izquierdo y derecho, ambos obligatorios" },
];

export const RESOURCE_PHASES = [
  {
    id: "request",
    code: "REQUEST",
    title: "Solicita",
    text: "P0 pide el tenedor F1 al sistema.",
  },
  {
    id: "hold",
    code: "HOLD",
    title: "Retiene",
    text: "F1 estaba libre: queda asignado a P0 y nadie más puede usarlo.",
  },
  {
    id: "wait",
    code: "WAIT",
    title: "Espera",
    text: "P1 también necesita F1. Está ocupado, así que P1 queda en espera.",
  },
] as const;

export const CONDITIONS = [
  {
    index: "01",
    title: "Exclusión mutua",
    text: "Un tenedor solo puede estar en manos de un filósofo a la vez.",
    example: "F1 → P0 · P1 no puede compartirlo",
  },
  {
    index: "02",
    title: "Retención y espera",
    text: "Cada filósofo conserva el tenedor que ya tiene mientras espera el segundo.",
    example: "P0 retiene F0 y solicita F1",
  },
  {
    index: "03",
    title: "No expropiación",
    text: "Nadie puede quitarle un tenedor a otro. Solo se libera de forma voluntaria.",
    example: "F1 no puede ser arrebatado a P1",
  },
  {
    index: "04",
    title: "Espera circular",
    text: "P0 espera a P1, P1 a P2, … y P4 espera a P0. La cadena se cierra.",
    example: "P0 → P1 → P2 → P3 → P4 → P0",
  },
];

export const STORY_STEPS = [
  {
    index: "01",
    title: "Todos piensan.",
    text: "Cinco procesos activos, cinco recursos libres. Nadie compite todavía.",
    readout: "0 / 5 recursos asignados",
  },
  {
    index: "02",
    title: "Todos tienen hambre.",
    text: "En el mismo instante, los cinco necesitan entrar a su sección crítica.",
    readout: "5 procesos listos para solicitar",
  },
  {
    index: "03",
    title: "Cada uno toma un tenedor.",
    text: "Cada filósofo toma el de su izquierda. Todas las solicitudes tienen éxito.",
    readout: "5 / 5 recursos asignados",
  },
  {
    index: "04",
    title: "Todos esperan el segundo.",
    text: "El tenedor de la derecha pertenece al vecino. Nadie suelta el suyo.",
    readout: "5 solicitudes pendientes",
  },
  {
    index: "05",
    title: "Nadie puede continuar.",
    text: "Cada espera depende de la siguiente. El grafo de espera forma un ciclo cerrado.",
    readout: "P0 → P1 → P2 → P3 → P4 → P0",
  },
];

export interface SolutionContent {
  index: string;
  mode: SimulationMode;
  title: string;
  idea: string;
  body: string;
  breaks: string;
  code: string[];
  orderNote: string;
}

export const SOLUTIONS: SolutionContent[] = [
  {
    index: "01",
    mode: "ordered",
    title: "Orden total de recursos",
    idea: "Numerar los recursos y solicitarlos siempre en orden creciente.",
    body: "Cada filósofo pide primero el tenedor de menor número. Cuatro de ellos toman el izquierdo, pero P4 debe pedir F0 antes que F4. Una espera solo puede apuntar a un recurso mayor, así que la cadena nunca vuelve a su origen.",
    breaks: "Espera circular",
    code: [
      "// cada tenedor tiene un número global",
      "primero = min(izq, der)",
      "segundo = max(izq, der)",
      "",
      "wait(tenedor[primero])",
      "wait(tenedor[segundo])",
      "comer()",
      "signal(tenedor[segundo])",
      "signal(tenedor[primero])",
    ],
    orderNote: "P4 solicita F0 → F4",
  },
  {
    index: "02",
    mode: "limited",
    title: "Limitar la concurrencia",
    idea: "Permitir como máximo N − 1 filósofos compitiendo a la vez.",
    body: "Un semáforo contador con valor 4 funciona como la puerta de la sala. Con cinco tenedores y solo cuatro procesos compitiendo, al menos uno siempre consigue los dos y termina liberándolos.",
    breaks: "Espera circular (el ciclo necesita a los cinco)",
    code: [
      "semaforo sala = 4        // N − 1",
      "",
      "wait(sala)",
      "wait(tenedor[izq])",
      "wait(tenedor[der])",
      "comer()",
      "signal(tenedor[der])",
      "signal(tenedor[izq])",
      "signal(sala)",
    ],
    orderNote: "Sala: 4 turnos",
  },
  {
    index: "03",
    mode: "asymmetric",
    title: "Estrategia asimétrica",
    idea: "No todos los procesos siguen la misma regla de adquisición.",
    body: "Los filósofos pares toman primero el izquierdo; los impares, primero el derecho. Dos vecinos terminan compitiendo por el mismo primer tenedor, y el que lo pierde no retiene nada mientras espera.",
    breaks: "Espera circular (rompe la simetría)",
    code: [
      "if (id % 2 == 0) {",
      "  wait(tenedor[izq])",
      "  wait(tenedor[der])",
      "} else {",
      "  wait(tenedor[der])",
      "  wait(tenedor[izq])",
      "}",
      "comer()",
      "signal(tenedor[izq]); signal(tenedor[der])",
    ],
    orderNote: "Impares: derecho → izquierdo",
  },
  {
    index: "04",
    mode: "monitor",
    title: "Dos tenedores o ninguno",
    idea: "Tomar ambos recursos en una sola operación atómica, o no tomar ninguno.",
    body: "Un monitor guarda el estado de cada filósofo. Solo pasa a comer si ninguno de sus dos vecinos está comiendo, y en ese caso toma los dos tenedores a la vez. Si no puede, espera con las manos vacías hasta que un vecino termine y le avise. Nadie retiene un tenedor mientras espera el otro, así que la cadena no puede formarse. Su riesgo es otro: un filósofo cuyos vecinos se turnan para comer podría esperar indefinidamente (inanición).",
    breaks: "Retención y espera",
    code: [
      "monitor Mesa {",
      "  estado[5] = PENSANDO",
      "  tomar(i):  estado[i] = HAMBRIENTO",
      "             probar(i)",
      "             if (estado[i] != COMIENDO) puede[i].wait()",
      "  soltar(i): estado[i] = PENSANDO",
      "             probar(izq(i)); probar(der(i))",
      "  probar(i): if (estado[i] == HAMBRIENTO && vecinos sin comer)",
      "               estado[i] = COMIENDO; puede[i].signal()",
      "}",
    ],
    orderNote: "Ambos a la vez",
  },
];

export const COMPARISON = [
  {
    strategy: "Orden total",
    idea: "Numerar los recursos y adquirirlos en orden creciente.",
    avoids: "Espera circular",
    complexity: "Baja. Exige un orden global conocido por todos los procesos.",
  },
  {
    strategy: "Limitar concurrencia",
    idea: "Un semáforo admite como máximo N − 1 procesos compitiendo.",
    avoids: "Espera circular, al impedir que los N retengan un recurso",
    complexity: "Media. Añade un recurso de sincronización y reduce el paralelismo posible.",
  },
  {
    strategy: "Estrategia asimétrica",
    idea: "Pares e impares solicitan los tenedores en orden inverso.",
    avoids: "Espera circular, al romper la simetría del protocolo",
    complexity: "Baja. La regla depende del identificador de cada proceso.",
  },
  {
    strategy: "Dos o ninguno",
    idea: "Un monitor entrega los dos tenedores a la vez, solo si ambos vecinos no están comiendo.",
    avoids: "Retención y espera: quien espera no retiene nada",
    complexity: "Media. Requiere un monitor con estado por proceso y puede causar inanición.",
  },
];

export const TEAM = [
  { name: "Esteban", initials: "E" },
  { name: "Jesús", initials: "J" },
  { name: "Juan Camilo", initials: "JC" },
];
