import { COMPARISON } from "@/lib/content";
import { Reveal } from "./Reveal";
import { SectionHeader } from "./SectionHeader";

const COLUMNS = ["Estrategia", "Idea", "Qué evita", "Complejidad conceptual"];

export function Comparison() {
  return (
    <section id="comparacion" aria-labelledby="comparacion-title" className="hairline-t relative bg-bg-1/60">
      <div className="shell grid-editorial gap-y-14 py-28 md:py-36 lg:py-40">
        <div className="col-span-12 lg:col-span-6">
          <SectionHeader index="10" eyebrow="Comparación" id="comparacion-title" title="Cuatro caminos hacia el mismo objetivo." />
        </div>
        <p className="body col-span-12 self-end lg:col-span-4 lg:col-start-9">
          Las tres primeras impiden la espera circular; la cuarta, la retención y espera. Difieren en dónde colocan la
          restricción y en lo que cuesta sostenerla.
        </p>

        <Reveal delay={0.1} className="col-span-12">
          <table className="hidden w-full border-collapse text-left md:table">
            <caption className="label pb-6 text-left text-ink-3">Tabla 10 — Comparación descriptiva de estrategias</caption>
            <thead>
              <tr className="border-b border-[var(--hairline-strong)]">
                {COLUMNS.map((c) => (
                  <th key={c} scope="col" className="label pb-4 pr-8 font-normal text-ink-3">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row.strategy} className="hairline-b align-top transition-colors hover:bg-bg-3/40">
                  <th scope="row" className="w-[22%] py-7 pr-8 font-normal">
                    <span className="label mr-4 text-ink-3">0{i + 1}</span>
                    <span className="text-[17px] text-ink">{row.strategy}</span>
                  </th>
                  <td className="w-[30%] py-7 pr-8 text-[15px] leading-relaxed text-ink-2">{row.idea}</td>
                  <td className="w-[22%] py-7 pr-8 text-[15px] leading-relaxed text-ink">{row.avoids}</td>
                  <td className="py-7 text-[15px] leading-relaxed text-ink-2">{row.complexity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="md:hidden">
            <p className="label pb-4 text-ink-3">Tabla 10 — Comparación descriptiva</p>
            {COMPARISON.map((row, i) => (
              <dl key={row.strategy} className="hairline-t grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 py-6 text-[14px]">
                <dt className="label pt-1 text-ink-3">0{i + 1}</dt>
                <dd className="text-[17px] text-ink">{row.strategy}</dd>
                {(
                  [
                    ["Idea", row.idea],
                    ["Qué evita", row.avoids],
                    ["Complejidad", row.complexity],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="label pt-1 text-ink-3">{k}</dt>
                    <dd className="leading-relaxed text-ink-2">{v}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
