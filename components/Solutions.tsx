import { SOLUTIONS } from "@/lib/content";
import { SectionHeader } from "./SectionHeader";
import { SolutionSection } from "./SolutionSection";

export function Solutions() {
  return (
    <section id="soluciones" aria-labelledby="soluciones-title" className="hairline-t relative">
      <div className="shell pt-28 md:pt-36 lg:pt-40">
        <div className="grid-editorial gap-y-6 pb-16 lg:pb-24">
          <div className="col-span-12 lg:col-span-6">
            <SectionHeader index="09" eyebrow="Soluciones" id="soluciones-title" title="Romper el ciclo.">
              <p>
                Si las cuatro condiciones son necesarias, basta con impedir una. Las tres primeras estrategias atacan
                la espera circular; la cuarta ataca la retención y espera. Todas parten del mismo escenario: los
                cinco tienen hambre en el mismo instante.
              </p>
            </SectionHeader>
          </div>
          <ol className="col-span-12 self-end lg:col-span-4 lg:col-start-9">
            {SOLUTIONS.map((s) => (
              <li key={s.index} className="hairline-t flex items-baseline gap-4 py-3">
                <span className="label text-ink-3">{s.index}</span>
                <span className="text-[15px] text-ink-2">{s.title}</span>
              </li>
            ))}
          </ol>
        </div>

        {SOLUTIONS.map((s, i) => (
          <SolutionSection key={s.index} content={s} flip={i % 2 === 1} />
        ))}
      </div>
    </section>
  );
}
