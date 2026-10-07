"use client";

import { useInView } from "framer-motion";
import { Play, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { SEATS } from "@/lib/constants";
import type { SolutionContent } from "@/lib/content";
import { acquisitionOrder, totalMeals } from "@/lib/simulation";
import { useSimulation } from "@/lib/useSimulation";
import { CodeBlock } from "./CodeBlock";
import { useMotionPreference } from "./MotionProvider";
import { Reveal } from "./Reveal";
import { StatusIndicator } from "./StatusIndicator";
import { SystemDiagram } from "./SystemDiagram";

function OrderTable({ content, sim }: { content: SolutionContent; sim: ReturnType<typeof useSimulation> }) {
  const { state } = sim;
  return (
    <div>
      <p className="label flex justify-between text-ink-3">
        <span>{content.mode === "monitor" ? "Adquisición atómica" : "Orden de adquisición"}</span>
        {content.mode === "limited" && (
          <span className="tabular-nums text-ink-2">
            sala {SEATS - state.seats}/{SEATS}
          </span>
        )}
      </p>
      <ul className="mt-3 grid grid-cols-5 gap-2 font-mono text-[12px]">
        {state.philosophers.map((p) => {
          const atomic = content.mode === "monitor";
          const [a, b] = acquisitionOrder(p, content.mode);
          const differs = atomic || a !== p.leftFork;
          return (
            <li key={p.id} className={`hairline flex flex-col items-center gap-1 py-2.5 ${differs ? "border-blue-2/50" : ""}`}>
              <span className="text-ink">P{p.id}</span>
              <span className={differs ? "text-blue-2" : "text-ink-3"}>
                {atomic ? `F${p.leftFork}+F${p.rightFork}` : `F${a}→F${b}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SolutionSection({ content, flip = false }: { content: SolutionContent; flip?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const { reduced } = useMotionPreference();
  const sim = useSimulation(content.mode, { active: inView, initialSpeed: 1.5 });
  const { state, play } = sim;
  const started = useRef(false);

  useEffect(() => {
    if (inView && !started.current && !reduced) {
      started.current = true;
      play();
    }
  }, [inView, reduced, play]);

  const meals = state.philosophers.filter((p) => p.meals > 0).length;
  const resolved = state.status === "resolved";

  return (
    <article ref={ref} aria-labelledby={`sol-${content.index}`} className="hairline-t grid-editorial gap-y-12 py-20 lg:py-28">
      <Reveal className={`col-span-12 lg:col-span-5 ${flip ? "lg:order-2 lg:col-start-8" : ""}`}>
        <p className="label text-blue-2">Estrategia {content.index}</p>
        <h3 id={`sol-${content.index}`} className="mt-4 text-[30px] font-medium leading-[1.05] tracking-[-0.03em] text-ink md:text-[40px]">
          {content.title}
        </h3>
        <p className="serif mt-5 text-[22px] italic leading-snug text-ink-2">{content.idea}</p>
        <p className="body mt-5">{content.body}</p>
        <dl className="hairline-t mt-8 grid grid-cols-[7rem_1fr] gap-y-2 pt-4 text-[14px]">
          <dt className="label pt-0.5 text-ink-3">Rompe</dt>
          <dd className="text-ink">{content.breaks}</dd>
        </dl>
        <div className="mt-8">
          <CodeBlock lines={content.code} label={`Estrategia ${content.index}`} />
        </div>
      </Reveal>

      <Reveal delay={0.1} className={`col-span-12 lg:col-span-6 ${flip ? "lg:order-1 lg:col-start-1" : "lg:col-start-7"}`}>
        <div className="hairline bg-bg-1/70">
          <div className="hairline-b flex items-center justify-between px-5 py-3">
            <p className="label text-ink-3">
              Fig. 09.{content.index}
              <span className="hidden sm:inline"> — Misma carga, sin ciclo</span>
            </p>
            <button
              type="button"
              onClick={() => (state.status === "idle" ? sim.play() : sim.restart())}
              className="btn btn-ghost h-8 px-3 text-[12px]"
            >
              {state.status === "idle" ? <Play size={12} aria-hidden /> : <RotateCcw size={12} aria-hidden />}
              {state.status === "idle" ? "Ejecutar" : "Repetir"}
            </button>
          </div>
          <div className="relative px-6 pt-4 sm:px-10">
            <div aria-hidden className="system-grid pointer-events-none absolute inset-0" />
            <SystemDiagram
              philosophers={state.philosophers}
              forks={state.forks}
              cycle={state.cycle}
              showStateLabels={false}
              title={`Simulación de la estrategia ${content.title}`}
              description="Los cinco filósofos tienen hambre en el mismo instante; la estrategia evita que se forme un ciclo."
              center={{ eyebrow: `t = ${String(state.tick).padStart(3, "0")}`, title: `${meals}/5 COMIERON`, tone: resolved ? "blue" : "neutral" }}
              className="relative mx-auto w-full max-w-[440px]"
            />
          </div>
          <div className="px-5 pb-5">
            <OrderTable content={content} sim={sim} />
          </div>
          <div className="hairline-t flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <span className="label text-ink-3">Resultado</span>
            <StatusIndicator
              state={resolved ? "resolved" : state.status === "idle" ? "idle" : "running"}
              label={resolved ? "Sin deadlock · 5/5 progresan" : state.status === "idle" ? "En espera" : "Ejecutando"}
            />
            <span className="font-mono text-[12px] text-ink-3">
              ciclos detectados <span className={state.cycle ? "text-red" : "text-ink-2"}>{state.cycle ? 1 : 0}</span> · comidas <span className="text-ink-2 tabular-nums">{totalMeals(state)}</span>
            </span>
          </div>
        </div>
      </Reveal>
    </article>
  );
}
