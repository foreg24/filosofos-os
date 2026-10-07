/**
 * Lo que pasa dentro del servidor de THAI·NOW: transacciones (pedidos) que bloquean filas del
 * inventario (ingredientes). La solución se calcula con el mismo motor de la simulación de la
 * página (modo "ordered"): los pedidos son los filósofos y los ingredientes los tenedores.
 */
import { AlertTriangle, Check, Database, LoaderCircle, Lock } from "lucide-react";
import { useMemo } from "react";
import { advance, createSimulation } from "@/lib/simulation";
import type { SimulationState } from "@/lib/types";
import { CUSTOMERS, INGREDIENTS, recipeOf } from "./data";
import type { ScreenId } from "./steps";

const N = CUSTOMERS.length;

type TxStatus = "idle" | "begin" | "holding" | "waiting" | "blocked" | "eating" | "confirmed" | "aborted";

interface View {
  tx: { status: TxStatus; waits: number | null }[];
  /** owner[f]: pedido que tiene bloqueado el ingrediente f. */
  owner: (number | null)[];
  cycle: boolean;
  badge: { text: string; tone: "ok" | "warn" | "alert" };
}

const empty = (): View => ({ tx: CUSTOMERS.map(() => ({ status: "idle", waits: null })), owner: INGREDIENTS.map(() => null), cycle: false, badge: { text: "En línea", tone: "ok" } });

/* --------------------------------------------------- vistas por paso -- */

function holdView(t: number): View {
  const v = empty();
  v.badge = { text: "Procesando 5 pedidos", tone: "ok" };
  for (let i = 0; i < N; i++) {
    if (t >= 1200 + 800 * i) {
      v.tx[i].status = "holding";
      v.owner[i] = i;
    } else if (t >= 500) v.tx[i].status = "begin";
  }
  return v;
}

function deadlockView(t = Infinity): View {
  const v = empty();
  v.owner = INGREDIENTS.map((_, i) => i);
  v.badge = { text: "Procesando 5 pedidos", tone: "ok" };
  for (let i = 0; i < N; i++) {
    v.tx[i].status = "holding";
    if (t >= 1000 + 700 * i) v.tx[i] = { status: "waiting", waits: (i + 1) % N };
  }
  if (t >= 5400) {
    v.cycle = true;
    v.tx.forEach((x) => (x.status = "blocked"));
    v.badge = { text: "DEADLOCK", tone: "alert" };
  }
  return v;
}

function detectView(t: number): View {
  const v = deadlockView();
  if (t < 4200) return v;
  // InnoDB elige a T-Eli como víctima: ROLLBACK libera el maní y el resto avanza en cadena.
  v.cycle = false;
  v.tx[4] = { status: "aborted", waits: null };
  v.owner[4] = null;
  v.badge = { text: "Recuperando", tone: "warn" };
  const commits = [
    [3, 5600],
    [2, 6200],
    [1, 6800],
    [0, 7400],
  ] as const;
  for (const [id, at] of commits) {
    if (t >= at) {
      v.tx[id] = { status: "confirmed", waits: null };
      v.owner[id] = null;
      if (id === 3) v.owner[4] = null;
    } else {
      v.tx[id].status = "waiting";
    }
  }
  if (t >= 7400) v.badge = { text: "Recuperado · 1 pedido cancelado", tone: "warn" };
  return v;
}

/** Fotogramas reales del motor con orden total: cada pedido termina al confirmar por primera vez. */
function solutionFrames(): View[] {
  const frames: View[] = [];
  let s: SimulationState = createSimulation("ordered", 1);
  const done = new Set<number>();
  for (let k = 0; k < 80 && done.size < N; k++) {
    s = advance(s);
    const v = empty();
    v.badge = { text: "Procesando 5 pedidos", tone: "ok" };
    for (const p of s.philosophers) {
      if (done.has(p.id)) {
        v.tx[p.id].status = "confirmed";
        continue;
      }
      if (p.meals > 0 || p.state === "eating") {
        v.tx[p.id].status = "eating";
        done.add(p.id);
      } else if (p.state === "holding") v.tx[p.id].status = "holding";
      else if (p.state === "waiting") v.tx[p.id] = { status: "waiting", waits: p.waitingFor };
      else if (p.state === "hungry") v.tx[p.id].status = "begin";
    }
    for (const f of s.forks) v.owner[f.id] = f.heldBy !== null && !(done.has(f.heldBy) && v.tx[f.heldBy].status === "confirmed") ? f.heldBy : null;
    frames.push(v);
  }
  const last = frames[frames.length - 1];
  last.tx.forEach((x) => (x.status = "confirmed"));
  last.owner = INGREDIENTS.map(() => null);
  last.badge = { text: "5 / 5 confirmados · 0 ciclos", tone: "ok" };
  return frames;
}

/* --------------------------------------------------------------- anillo -- */

const CX = 230;
const CY = 232;
const polar = (r: number, deg: number) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)] as const;
const customerAt = (i: number) => polar(170, -90 + i * 72);
const ingredientAt = (f: number) => polar(92, -90 + (f - 0.5) * 72);

function segment(from: readonly [number, number], to: readonly [number, number], startGap: number, endGap: number) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  return { x1: from[0] + ux * startGap, y1: from[1] + uy * startGap, x2: to[0] - ux * endGap, y2: to[1] - uy * endGap };
}

function Ring({ view }: { view: View }) {
  const red = "#F87171";
  const hold = view.cycle ? red : "#6EE7B7";
  const wait = view.cycle ? red : "#FBBF24";
  return (
    <svg viewBox="0 0 460 470" className="h-full w-full" role="img" aria-label="Pedidos e ingredientes del inventario">
      <defs>
        {[
          ["h", hold],
          ["w", wait],
        ].map(([id, color]) => (
          <marker key={id} id={`caso-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill={color} />
          </marker>
        ))}
      </defs>
      <circle cx={CX} cy={CY} r="170" fill="none" stroke="rgba(255,255,255,0.06)" />
      {view.owner.map((owner, f) => {
        if (owner === null) return null;
        const s = segment(ingredientAt(f), customerAt(owner), 24, 34);
        return <line key={`h${f}`} {...s} stroke={hold} strokeWidth="2.4" markerEnd="url(#caso-h)" />;
      })}
      {view.tx.map((x, i) => {
        if (x.waits === null) return null;
        const s = segment(customerAt(i), ingredientAt(x.waits), 34, 26);
        return <line key={`w${i}`} {...s} stroke={wait} strokeWidth="2.2" strokeDasharray="6 5" markerEnd="url(#caso-w)" />;
      })}
      {INGREDIENTS.map((ing, f) => {
        const [x, y] = ingredientAt(f);
        const held = view.owner[f] !== null;
        return (
          <g key={ing.id}>
            <rect x={x - 38} y={y - 15} width="76" height="30" rx="8" fill={held ? (view.cycle ? "#3B1416" : "#123326") : "#151C19"} stroke={held ? (view.cycle ? red : "#6EE7B7") : "rgba(255,255,255,0.15)"} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#E7ECE8">
              {ing.short}
            </text>
          </g>
        );
      })}
      {CUSTOMERS.map((c, i) => {
        const [x, y] = customerAt(i);
        const st = view.tx[i].status;
        const color = st === "blocked" ? red : st === "aborted" ? "#9CA3AF" : st === "confirmed" || st === "eating" ? "#6EE7B7" : st === "waiting" ? "#FBBF24" : "#E7ECE8";
        return (
          <g key={c.id}>
            <circle cx={x} cy={y} r="30" fill="#0F1714" stroke={color} strokeWidth="2.2" />
            <text x={x} y={y + 1} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
              {c.name}
            </text>
            <text x={x} y={y + 14} textAnchor="middle" fontSize="8" fill="rgba(231,236,232,0.6)">
              {st === "confirmed" ? "confirmado" : st === "aborted" ? "cancelado" : c.short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------------------- paneles -- */

const Panel = ({ title, children, code = false }: { title: string; children: React.ReactNode; code?: boolean }) => (
  <section className="rounded-xl border border-white/10 bg-white/[0.03]">
    <p className={`border-b border-white/10 px-4 py-2.5 text-[#8FA197] ${code ? "font-mono text-[12px]" : "text-[11px] font-semibold uppercase tracking-[0.12em]"}`}>{title}</p>
    {children}
  </section>
);

function InventoryTable({ view }: { view: View }) {
  return (
    <Panel title="Tabla inventario · filas bloqueadas">
      <table className="w-full text-[12px]">
        <thead className="text-left text-[10px] uppercase tracking-[0.08em] text-[#6E8077]">
          <tr>
            <th className="px-4 py-2 font-medium">ID</th>
            <th className="font-medium">Ingrediente</th>
            <th className="font-medium">Stock</th>
            <th className="font-medium">Bloqueado por</th>
            <th className="pr-4 font-medium">En espera</th>
          </tr>
        </thead>
        <tbody>
          {INGREDIENTS.map((ing, f) => {
            const owner = view.owner[f];
            const waiting = view.tx.map((x, i) => (x.waits === f ? CUSTOMERS[i].name : null)).filter(Boolean);
            return (
              <tr key={ing.id} className={`border-t border-white/5 ${owner !== null && view.cycle ? "bg-[#3B1416]/60" : ""}`}>
                <td className="px-4 py-2 font-mono text-[#8FA197]">{ing.id + 1}</td>
                <td className="text-[#E7ECE8]">{ing.name}</td>
                <td className="font-mono text-[#E7ECE8]">1</td>
                <td>
                  {owner !== null ? (
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] ${view.cycle ? "bg-[#F87171]/15 text-[#FCA5A5]" : "bg-[#6EE7B7]/12 text-[#6EE7B7]"}`}>
                      <Lock size={10} /> T-{CUSTOMERS[owner].name}
                    </span>
                  ) : (
                    <span className="text-[#5E6E66]">—</span>
                  )}
                </td>
                <td className="pr-4 font-mono text-[11px] text-[#FBBF24]">{waiting.length ? waiting.map((w) => `T-${w}`).join(", ") : <span className="text-[#5E6E66]">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

const STATUS_TEXT = (status: TxStatus, i: number, view: View) => {
  const [first, second] = recipeOf(i);
  const w = view.tx[i].waits;
  switch (status) {
    case "idle":
      return ["En cola", "text-[#6E8077]"];
    case "begin":
      return ["BEGIN", "text-[#E7ECE8]"];
    case "holding":
      return [`Tiene ${view.owner.indexOf(i) >= 0 ? INGREDIENTS[view.owner.indexOf(i)].short.toLowerCase() : first.short.toLowerCase()}`, "text-[#6EE7B7]"];
    case "waiting":
      return [`Espera ${w !== null ? INGREDIENTS[w].short.toLowerCase() : second.short.toLowerCase()}${w !== null && view.owner[w] !== null ? ` · de T-${CUSTOMERS[view.owner[w] as number].name}` : ""}`, "text-[#FBBF24]"];
    case "blocked":
      return [`Bloqueada · espera ${second.short.toLowerCase()}`, "text-[#FCA5A5]"];
    case "eating":
      return ["Reservó ambos · COMMIT", "text-[#6EE7B7]"];
    case "confirmed":
      return ["COMMIT · confirmado", "text-[#6EE7B7]"];
    case "aborted":
      return ["ROLLBACK · cancelado", "text-[#9CA3AF]"];
  }
};

function TxList({ view }: { view: View }) {
  return (
    <Panel title="Transacciones (un proceso por pedido)">
      <ul>
        {CUSTOMERS.map((c, i) => {
          const st = view.tx[i].status;
          const [text, color] = STATUS_TEXT(st, i, view);
          return (
            <li key={c.id} className="flex items-center gap-3 border-t border-white/5 px-4 py-2 text-[12px] first:border-t-0">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-[#E7ECE8]">{c.name[0]}</span>
              <span className="w-[150px] text-[#E7ECE8]">
                T-{c.name} <span className="text-[#6E8077]">· {c.dish}</span>
              </span>
              <span className={`ml-auto flex items-center gap-1.5 font-mono text-[11px] ${color}`}>
                {(st === "waiting" || st === "begin") && <LoaderCircle size={11} className="animate-spin" />}
                {(st === "confirmed" || st === "eating") && <Check size={11} />}
                {st === "blocked" && <Lock size={11} />}
                {text}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

const CONDITIONS = [
  ["Exclusión mutua", "Una porción reservada (fila con FOR UPDATE) solo puede ser de un pedido a la vez.", 1000],
  ["Retención y espera", "Cada pedido conserva su primer ingrediente mientras espera el segundo.", 3500],
  ["No expropiación", "El servidor no le quita una reserva a un pedido: solo se libera con COMMIT o ROLLBACK.", 6000],
  ["Espera circular", "Ana espera a Beto, Beto a Caro, Caro a Dani, Dani a Eli… y Eli espera a Ana.", 8500],
] as const;

function ConditionCards({ t }: { t: number }) {
  return (
    <div className="grid gap-3">
      {CONDITIONS.map(([title, text, at], i) => {
        const shown = t >= at;
        return (
          <div
            key={title}
            className={`rounded-xl border px-5 py-4 transition-all duration-500 ${shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"} ${i === 3 ? "border-[#F87171]/50 bg-[#3B1416]/50" : "border-white/10 bg-white/[0.04]"}`}
          >
            <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${i === 3 ? "text-[#FCA5A5]" : "text-[#8FA197]"}`}>Condición 0{i + 1}</p>
            <p className="mt-1 text-[16px] font-semibold text-[#F2F5F3]">{title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#B5C2BA]">{text}</p>
          </div>
        );
      })}
    </div>
  );
}

function ErrorBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#F87171]/45 bg-[#3B1416]/70 px-4 py-3">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#FCA5A5]" />
      <div>
        <p className="font-mono text-[12px] text-[#FCA5A5]">ERROR 1213 (40001): Deadlock found when trying to get lock; try restarting transaction</p>
        <p className="mt-1 text-[11.5px] text-[#D7B5B5]">InnoDB eligió a T-Eli como víctima y deshizo su transacción.</p>
      </div>
    </div>
  );
}

function CodeDiff() {
  return (
    <Panel title="reservarIngredientes() · cambio de una línea" code>
      <pre className="px-4 py-3 font-mono text-[12px] leading-relaxed">
        <span className="block text-[#FCA5A5]">- for (const id of receta)</span>
        <span className="block text-[#6EE7B7]">+ for (const id of [...receta].sort())   // menor ID primero</span>
        <span className="block text-[#8FA197]">{"    "}SELECT … WHERE id = ? FOR UPDATE;</span>
      </pre>
    </Panel>
  );
}

/* --------------------------------------------------------- pantallas -- */

function ServerShell({ view, t, children }: { view: View; t: number; children: React.ReactNode }) {
  // El reloj del servidor corre en milisegundos: todo esto ocurre en menos de medio segundo.
  const ms = 120 + Math.floor(t / 25);
  const clock = `12:00:${String(Math.floor(ms / 1000)).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
  const tone = { ok: "bg-[#6EE7B7]/12 text-[#6EE7B7]", warn: "bg-[#FBBF24]/12 text-[#FBBF24]", alert: "bg-[#F87171]/15 text-[#FCA5A5]" }[view.badge.tone];
  return (
    <div className="flex h-full flex-col bg-[#0A100D] text-[#E7ECE8]">
      <header className="flex h-[56px] items-center justify-between border-b border-white/10 px-8">
        <div className="flex items-center gap-3">
          <Database size={18} className="text-[#6EE7B7]" />
          <p className="text-[14px] font-semibold">
            THAI·NOW <span className="font-normal text-[#8FA197]">· Panel del servidor</span>
          </p>
          <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[11px] text-[#8FA197]">db-inventario · MySQL 8.4</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[12px] text-[#8FA197]">{clock}</span>
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${tone} ${view.badge.tone === "alert" ? "animate-pulse" : ""}`}>{view.badge.text}</span>
        </div>
      </header>
      <div className="grid flex-1 grid-cols-[480px_1fr] gap-6 px-8 py-5">
        <div className="relative">
          <p className="absolute left-0 top-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8FA197]">Grafo de espera</p>
          <Ring view={view} />
          <div className="absolute bottom-1 left-0 flex gap-5 text-[11px] text-[#8FA197]">
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-5 bg-[#6EE7B7]" /> tiene el ingrediente
            </span>
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-5 border-t-2 border-dashed border-[#FBBF24]" /> lo espera
            </span>
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

export function ServerScreen({ screen, t }: { screen: ScreenId; t: number }) {
  const frames = useMemo(solutionFrames, []);
  if (screen === "server-hold") {
    const v = holdView(t);
    return (
      <ServerShell view={v} t={t}>
        <InventoryTable view={v} />
        <TxList view={v} />
      </ServerShell>
    );
  }
  if (screen === "server-cycle") {
    const v = deadlockView(t);
    return (
      <ServerShell view={v} t={5000 + t}>
        <InventoryTable view={v} />
        <TxList view={v} />
      </ServerShell>
    );
  }
  if (screen === "conditions") {
    const v = deadlockView();
    return (
      <ServerShell view={v} t={16000 + t}>
        <ConditionCards t={t} />
      </ServerShell>
    );
  }
  if (screen === "detect") {
    const v = detectView(t);
    return (
      <ServerShell view={v} t={29000 + t}>
        {t >= 2600 && <ErrorBanner />}
        <InventoryTable view={v} />
        <TxList view={v} />
      </ServerShell>
    );
  }
  // Solución: los fotogramas del motor reparten el tiempo entre 2,2 s y 9,3 s.
  const start = 2200;
  const span = 7100;
  const index = t < start ? -1 : Math.min(frames.length - 1, Math.floor(((t - start) / span) * frames.length));
  const v = index < 0 ? empty() : frames[index];
  return (
    <ServerShell view={v} t={t}>
      <CodeDiff />
      <TxList view={v} />
    </ServerShell>
  );
}

/* ------------------------------------------------------------ resumen -- */

const ROWS = [
  ["Cliente con su pedido", "Filósofo", "Proceso (transacción)"],
  ["Ingrediente del inventario", "Tenedor", "Recurso compartido"],
  ["Reservar con FOR UPDATE", "Tomar un tenedor", "Adquirir un lock · wait()"],
  ["Pedido confirmado (COMMIT)", "Comer", "Sección crítica"],
  ["Pedidos colgados en «Confirmando…»", "Todos con un tenedor, esperando otro", "Deadlock"],
  ["MySQL cancela el pedido de Eli", "—", "Detección y recuperación"],
  ["Reservar en orden de ID", "Pedir primero el tenedor de menor número", "Orden total de recursos"],
];

export function SummaryScreen() {
  return (
    <div className="flex h-full flex-col bg-[#F7F6F1] px-14 py-10 text-[#1B2A21]">
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#1F5E3B]">¿Qué pasó aquí?</p>
      <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.02em]">Un almuerzo con el problema de los filósofos comensales</h2>
      <table className="mt-7 w-full overflow-hidden rounded-2xl text-left text-[13.5px]">
        <thead className="bg-[#1F5E3B] text-white">
          <tr>
            {["En THAI·NOW", "Filósofos comensales", "Sistema operativo"].map((h) => (
              <th key={h} className="px-5 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {ROWS.map((r, i) => (
            <tr key={r[0]} className={`border-t border-[#ECEAE2] ${i === 4 ? "bg-[#FFF1F0]" : i === 6 ? "bg-[#EEF6EA]" : ""}`}>
              <td className="px-5 py-3 font-medium">{r[0]}</td>
              <td className="px-5 py-3 text-[#55604F]">{r[1]}</td>
              <td className={`px-5 py-3 font-semibold ${i === 4 ? "text-[#B42318]" : i === 6 ? "text-[#1F5E3B]" : ""}`}>{r[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
