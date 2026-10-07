"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, GitBranch } from "lucide-react";
import { useRef } from "react";
import { MODES, SEATS } from "@/lib/constants";
import { formatCycle, totalMeals, waitForGraph } from "@/lib/simulation";
import type { IndicatorState, SimulationState } from "@/lib/types";
import { DebianTerminal } from "./DebianTerminal/DebianTerminal";
import { SectionHeader } from "./SectionHeader";
import { useDemoSimulation, useSimulationViewport } from "./SimulationContext";
import { SimulationControls } from "./SimulationControls";
import { SimulationStatus } from "./SimulationStatus";
import { StatusIndicator } from "./StatusIndicator";
import { SystemDiagram } from "./SystemDiagram";

function indicator(state: SimulationState, running: boolean): { state: IndicatorState; label: string } {
  if (state.status === "deadlock") return { state: "deadlock", label: "Deadlock detected" };
  if (state.status === "idle") return { state: "idle", label: "Idle" };
  const base = state.status === "resolved" ? "Resolved" : "Running";
  return running ? { state: state.status === "resolved" ? "resolved" : "running", label: base } : { state: "idle", label: `${base} · en pausa` };
}

/** Franja superior del área visual: qué está pasando, en una línea. */
function Headline({ state, running }: { state: SimulationState; running: boolean }) {
  const waits = waitForGraph(state).length;
  let left: React.ReactNode;
  let right: React.ReactNode = <span className="text-ink-3">esperas activas {waits}</span>;

  if (state.status === "deadlock" && state.cycle) {
    left = (
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-red">
        <span className="flex items-center gap-2">
          <CircleAlert size={14} aria-hidden /> Deadlock detected
        </span>
        <span className="text-red/70">Cycle detected</span>
      </span>
    );
    right = <span className="text-red">{formatCycle(state.cycle)}</span>;
  } else if (state.status === "resolved") {
    left = (
      <span className="flex items-center gap-2 text-blue-2">
        <GitBranch size={14} aria-hidden /> Sin ciclo · 5/5 completaron su sección crítica
      </span>
    );
  } else if (state.status === "idle") {
    left = <span className="text-ink-3">Sistema listo · pulsa Iniciar o Paso</span>;
  } else {
    left = <span className="text-ink-2">{running ? "Ejecutando" : "En pausa"} · el detector revisa el grafo en cada tick</span>;
  }

  return (
    <div className="label hairline-b relative z-10 flex min-h-12 flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3 sm:px-6" role="status">
      {left}
      <span className="font-mono normal-case tracking-[0.06em]">{right}</span>
    </div>
  );
}

export function Simulation() {
  const section = useRef<HTMLElement>(null);
  const sim = useDemoSimulation();
  // El reloj corre mientras cualquier parte de la sección (panel o terminal) esté en pantalla.
  useSimulationViewport(section);
  const { state } = sim;
  const status = indicator(state, sim.running);
  const tone = state.status === "deadlock" ? "red" : state.status === "resolved" || sim.running ? "blue" : "neutral";

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "p") (sim.playing ? sim.pause : sim.play)();
    else if (key === "n") sim.stepOnce();
    else if (key === "r") sim.reset();
    else return;
    e.preventDefault();
  };

  const diagram = {
    philosophers: state.philosophers,
    forks: state.forks,
    cycle: state.cycle,
    title: "Simulación de los filósofos comensales",
    description: `Estado del sistema: ${status.label}. Tick ${state.tick}.`,
  };

  return (
    <section ref={section} id="simulacion" aria-labelledby="simulacion-title" className="hairline-t relative bg-bg-1/60">
      <div className="shell py-28 md:py-36 lg:py-40">
        <div className="grid-editorial gap-y-6">
          <div className="col-span-12 lg:col-span-6">
            <SectionHeader index="08" eyebrow="Simulación" id="simulacion-title" title="El sistema, en ejecución.">
              <p>
                Un modelo de estado real: cada tick, el planificador intercala a los cinco procesos y el detector revisa
                el grafo de espera. Provoca el bloqueo o prueba una estrategia que lo evita.
              </p>
            </SectionHeader>
          </div>
        </div>

        <div onKeyDown={onKeyDown} className="hairline mt-14 bg-bg/80">
          <div className="grid lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px]">
            <div className="hairline-b lg:border-b-0 lg:border-r lg:border-[var(--hairline)]">
              <SimulationControls
                mode={state.mode}
                status={state.status}
                playing={sim.playing}
                speed={sim.speed}
                onPlay={sim.play}
                onPause={sim.pause}
                onReset={() => sim.reset()}
                onStep={sim.stepOnce}
                onMode={(m) => sim.reset(m)}
                onSpeed={sim.setSpeed}
              />
            </div>

            <div className="relative flex flex-col overflow-hidden">
              <div aria-hidden className="system-grid pointer-events-none absolute inset-0" />
              <Headline state={state} running={sim.running} />
              <div className="relative flex flex-1 items-center justify-center px-4 pb-4 pt-6 sm:px-8 lg:pt-8">
                <SystemDiagram
                  {...diagram}
                  layout="ring"
                  center={{ eyebrow: `t = ${String(state.tick).padStart(3, "0")}`, title: state.status === "deadlock" ? "DEADLOCK" : state.status.toUpperCase(), tone }}
                  className="hidden max-h-[min(600px,82svh)] w-full max-w-[600px] sm:block"
                />
                <SystemDiagram {...diagram} layout="chain" className="w-full max-w-[360px] sm:hidden" />
              </div>
              <div className="relative h-16 px-5 text-center sm:px-6">
                <AnimatePresence>
                  {state.status === "deadlock" && (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, delay: 1.1 }}
                      className="text-[17px] tracking-[-0.01em] text-ink"
                    >
                      Todos esperan. <span className="text-ink-2">Nadie puede avanzar.</span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="hairline-t lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0 xl:border-[var(--hairline)]">
              <SimulationStatus state={state} />
            </div>
          </div>

          <div className="hairline-t flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 sm:px-6">
            <span className="label text-ink-3">System status</span>
            <span aria-live="polite">
              <StatusIndicator state={status.state} label={status.label} />
            </span>
            <dl className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[12px] text-ink-3 sm:ml-auto">
              <div className="flex gap-2">
                <dt>tick</dt>
                <dd className="text-ink-2 tabular-nums">{String(state.tick).padStart(3, "0")}</dd>
              </div>
              <div className="flex gap-2">
                <dt>comidas</dt>
                <dd className="text-ink-2 tabular-nums">{totalMeals(state)}</dd>
              </div>
              {state.mode === "limited" && (
                <div className="flex gap-2">
                  <dt>sala</dt>
                  <dd className="text-ink-2 tabular-nums">
                    {SEATS - state.seats}/{SEATS}
                  </dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt>modo</dt>
                <dd className="text-ink-2">{MODES.find((m) => m.id === state.mode)?.label}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mx-auto mt-28 max-w-[1120px] md:mt-36">
          <div className="mb-10 text-center">
            <p className="label text-ink-3">System terminal</p>
            <p className="mx-auto mt-4 max-w-[34rem] text-[15px] leading-relaxed text-ink-2">
              La máquina Debian donde corren los filósofos. Sus comandos controlan los mismos procesos que el panel de
              arriba.
            </p>
          </div>
          <DebianTerminal tty="pts/1" />
        </div>
      </div>
    </section>
  );
}
