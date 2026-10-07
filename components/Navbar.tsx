"use client";

import { Activity, ArrowRight, Menu, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NAV_LINKS } from "@/lib/constants";
import { useActiveSection } from "@/lib/useActiveSection";
import { CasoRealModal } from "./CasoReal/CasoRealModal";
import { useMotionPreference } from "./MotionProvider";

export function Navbar() {
  const active = useActiveSection();
  const { manual, toggle } = useMotionPreference();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [caso, setCaso] = useState(false);
  const closeCaso = useCallback(() => setCaso(false), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ${
        solid ? "perf-glass border-[var(--hairline)] bg-bg/75 backdrop-blur-xl" : "border-transparent bg-transparent"
      }`}
    >
      <nav aria-label="Principal" className="shell flex h-16 items-center justify-between gap-6">
        <a href="#inicio" className="font-mono text-[13px] font-medium tracking-[0.14em] text-ink" aria-label="DEADLOCK 06, volver al inicio">
          DEADLOCK <span className="text-ink-3">/</span> 06
        </a>

        <ul className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => {
            const current = link.sections.includes(active);
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  aria-current={current ? "location" : undefined}
                  className={`relative py-2 text-[13px] transition-colors duration-200 hover:text-ink ${current ? "text-ink" : "text-ink-2"}`}
                >
                  {link.label}
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 -bottom-[3px] h-px origin-left bg-blue-2 transition-transform duration-300 ${current ? "scale-x-100" : "scale-x-0"}`}
                  />
                </a>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setCaso(true)} className="btn btn-ghost hidden h-9 px-4 text-[13px] sm:inline-flex" aria-haspopup="dialog">
            Ver demostración
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={manual}
            aria-label={manual ? "Restaurar animaciones" : "Reducir movimiento"}
            title={manual ? "Movimiento reducido" : "Reducir movimiento"}
            className={`grid h-9 w-9 place-items-center rounded-full border transition-colors duration-200 hover:border-blue-2/50 ${
              manual ? "border-blue-2/50 text-blue-2" : "border-[var(--hairline-strong)] text-ink-2 hover:text-ink"
            }`}
          >
            <Activity size={15} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className="grid h-9 w-9 place-items-center rounded-full border border-[var(--hairline-strong)] text-ink-2 hover:text-ink lg:hidden"
          >
            {open ? <X size={15} aria-hidden /> : <Menu size={15} aria-hidden />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="menu-movil" className="shell hairline-t pb-6 pt-2 lg:hidden">
          <ul className="grid">
            {NAV_LINKS.map((link, i) => (
              <li key={link.href} className="hairline-b">
                <a href={link.href} onClick={() => setOpen(false)} className="flex items-baseline gap-4 py-4 text-[17px] text-ink">
                  <span className="label text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setCaso(true);
            }}
            className="btn btn-primary mt-6 w-full justify-center"
            aria-haspopup="dialog"
          >
            Ver demostración <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      )}
      <CasoRealModal open={caso} onClose={closeCaso} />
    </header>
  );
}
