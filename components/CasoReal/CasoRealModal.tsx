"use client";

/**
 * «Caso de la vida real»: un tutorial que recorre un pedido en THAI·NOW y muestra cómo aparece el
 * problema de los filósofos comensales dentro de su servidor. La página se mueve sola (cursor,
 * clics, tecleo); el panel de la derecha explica qué pasa internamente en cada paso.
 */
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Lock, Pause, Play, RotateCcw, ShoppingBag, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMotionPreference } from "../MotionProvider";
import { CUSTOMERS, PHOTO_CREDITS } from "./data";
import { ServerScreen, SummaryScreen } from "./ServerScreens";
import { type LogTone, type ScreenId, STEPS } from "./steps";
import { BankScreen, CartScreen, CheckoutScreen, ConfirmedScreen, HomeScreen, Lotus, MenuScreen, ProductScreen, WaitingScreen } from "./ThaiScreens";

/** Tamaño mínimo del diseño; el navegador simulado crece hasta llenar el espacio disponible. */
const DESIGN_W = 1200;
const DESIGN_H = 680;
const DESIGN_MAX_H = 1000;
const TICK = 100;

function Screen({ id, t }: { id: ScreenId; t: number }) {
  switch (id) {
    case "home":
      return <HomeScreen t={t} />;
    case "menu":
      return <MenuScreen t={t} />;
    case "product":
      return <ProductScreen t={t} />;
    case "cart":
      return <CartScreen t={t} />;
    case "checkout":
      return <CheckoutScreen t={t} />;
    case "bank":
      return <BankScreen t={t} />;
    case "waiting":
      return <WaitingScreen t={t} />;
    case "confirmed":
      return <ConfirmedScreen t={t} />;
    case "summary":
      return <SummaryScreen />;
    default:
      return <ServerScreen screen={id} t={t} />;
  }
}

const LOG_TONE: Record<LogTone, string> = {
  default: "text-ink-2",
  ok: "text-[#6EE7B7]",
  warn: "text-[#FBBF24]",
  alert: "text-red",
  muted: "text-ink-3",
  code: "font-mono text-[11.5px] text-blue-2",
};

export function CasoRealModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { reduced } = useMotionPreference();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [view, setView] = useState({ scale: 0.6, w: DESIGN_W, h: DESIGN_H });
  const { scale } = view;
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const design = useRef<HTMLDivElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);

  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const t = started ? elapsed : 0;

  const go = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
    setElapsed(0);
  }, []);

  const restart = useCallback(() => {
    setStarted(true);
    setPlaying(true);
    go(0);
  }, [go]);

  // Al cerrar, todo vuelve al inicio para la próxima vez.
  useEffect(() => {
    if (open) return;
    setStarted(false);
    setIndex(0);
    setElapsed(0);
    setPlaying(true);
    setCursor(null);
  }, [open]);

  // Reloj del paso.
  useEffect(() => {
    if (!open || !started || !playing) return;
    const id = window.setInterval(() => setElapsed((e) => e + TICK), TICK);
    return () => window.clearInterval(id);
  }, [open, started, playing, index]);

  // Avance automático.
  useEffect(() => {
    if (!started || !playing || !step.duration || last) return;
    if (elapsed >= step.duration) go(index + 1);
  }, [elapsed, started, playing, step.duration, last, index, go]);

  // Escala del navegador simulado: el diseño (mínimo 1200 × 680) llena el espacio disponible.
  useLayoutEffect(() => {
    const el = frame.current;
    if (!open || !el) return;
    const fit = () => {
      const s = Math.min(el.clientWidth / DESIGN_W, el.clientHeight / DESIGN_H);
      setView({ scale: s, w: el.clientWidth / s, h: Math.min(DESIGN_MAX_H, el.clientHeight / s) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Cursor: va al elemento (data-tour) de la acción en curso.
  const action = started ? [...(step.actions ?? [])].reverse().find((a) => t >= a.at) : undefined;
  const target = action?.target;
  useEffect(() => {
    if (!target) return;
    const id = requestAnimationFrame(() => {
      const root = design.current;
      const el = root?.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      if (!root || !el) return;
      const r = el.getBoundingClientRect();
      const base = root.getBoundingClientRect();
      setCursor({ x: (r.left - base.left + r.width / 2) / scale, y: (r.top - base.top + r.height / 2) / scale });
    });
    return () => cancelAnimationFrame(id);
  }, [target, scale, index]);
  const showCursor = started && Boolean(step.actions?.length) && cursor !== null && target !== undefined;
  const clicking = Boolean(action?.click && t - action.at < 450);

  // Teclado, foco y scroll de la página de fondo.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    startButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!started) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose, started, index, go]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="caso-title"
            className="hairline relative flex h-full max-h-[860px] w-full max-w-[1480px] flex-col overflow-hidden rounded-2xl bg-bg-1 shadow-[0_40px_120px_rgba(0,0,0,0.6)] lg:flex-row"
            initial={{ opacity: 0, y: reduced ? 0 : 16, scale: reduced ? 1 : 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : 10 }}
            transition={{ duration: reduced ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* ------------------------------------------- navegador -- */}
            <div className="flex min-h-0 shrink-0 basis-[42%] flex-col border-[var(--hairline)] p-3 sm:p-4 lg:shrink lg:basis-auto lg:flex-[1.7] lg:border-r">
              <div className="flex items-center gap-3 rounded-t-xl border border-b-0 border-white/10 bg-[#161B22] px-4 py-2.5">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-black/35 px-3 py-1.5 font-mono text-[11.5px] text-ink-2">
                  <Lock size={11} className="shrink-0 text-[#6EE7B7]" aria-hidden />
                  <span className="truncate">https://{started ? step.url : "thainow.co"}</span>
                </div>
              </div>
              <div ref={frame} className="relative min-h-[240px] flex-1 overflow-hidden rounded-b-xl border border-white/10 bg-black">
                <div
                  ref={design}
                  className="absolute left-1/2 top-1/2 origin-center overflow-hidden"
                  style={{ width: view.w, height: view.h, transform: `translate(-50%, -50%) scale(${scale})` }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={started ? step.screen : "intro"}
                      className="absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.3 }}
                    >
                      <Screen id={started ? step.screen : "home"} t={t} />
                    </motion.div>
                  </AnimatePresence>

                  {showCursor && cursor && (
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute left-0 top-0 z-20"
                      initial={false}
                      animate={{ x: cursor.x, y: cursor.y }}
                      transition={{ duration: reduced ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <span className={`absolute -left-5 -top-5 h-10 w-10 rounded-full border-2 border-[#F2B544] transition-all duration-300 ${clicking ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} />
                      <svg width="26" height="30" viewBox="0 0 26 30" className="-translate-x-[3px] -translate-y-[2px] drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]">
                        <path d="M3 2 3 24 9 18.5 13 27 17 25.2 13 16.8 21 16.8Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* ------------------------------------------ narración -- */}
            <aside className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 sm:p-7 lg:max-w-[460px] lg:overflow-visible">
              <div className="flex items-start justify-between gap-4">
                <p className="label text-blue-2">Caso de la vida real</p>
                <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-2 grid h-9 w-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-white/5 hover:text-ink">
                  <X size={17} />
                </button>
              </div>

              {!started ? (
                <div className="flex flex-1 flex-col">
                  <h2 id="caso-title" className="mt-4 text-[28px] font-medium leading-[1.1] tracking-[-0.03em] text-ink">
                    THAI·NOW: un almuerzo que nunca llegó
                  </h2>
                  <p className="body mt-4">
                    Una app de domicilios en hora pico. Vamos a seguir el pedido de Ana, paso a paso, y a mirar qué pasa dentro del servidor mientras otros cuatro clientes piden al mismo tiempo.
                  </p>
                  <ul className="mt-6 grid gap-2 text-[13px] text-ink-2">
                    {CUSTOMERS.map((c) => (
                      <li key={c.id} className="hairline-t flex items-center justify-between pt-2">
                        <span>
                          <span className="text-ink">{c.name}</span> · {c.dish}
                        </span>
                        <span className="font-mono text-[11px] text-ink-3">P{c.id}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    <button ref={startButton} type="button" onClick={restart} className="btn btn-primary h-12 w-full justify-center text-[15px]">
                      <ShoppingBag size={17} aria-hidden /> Iniciar pedido
                    </button>
                    <p className="mt-3 text-center text-[12px] text-ink-3">≈ 2 minutos · se reproduce solo · ← → para moverte, espacio para pausar</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col lg:min-h-0">
                  <div className="mt-4 flex items-baseline justify-between">
                    <p className="label text-ink-3">{step.chapter}</p>
                    <p className="font-mono text-[12px] text-ink-3">
                      {String(index + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
                    </p>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={step.id}
                      className="flex flex-1 flex-col lg:min-h-0"
                      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.3 }}
                    >
                      <h2 id="caso-title" className="mt-3 text-[24px] font-medium leading-[1.15] tracking-[-0.03em] text-ink">
                        {step.title}
                      </h2>
                      <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{step.body}</p>
                      {step.mapping && (
                        <p className="mt-4 w-fit rounded-full border border-blue-2/40 bg-blue/10 px-3 py-1 text-[12px] text-blue-2">{step.mapping}</p>
                      )}
                      {step.internal.length > 0 && (
                        <div className="hairline mt-5 min-h-[132px] flex-1 overflow-y-auto rounded-xl bg-black/30 p-4 lg:min-h-0">
                          <p className="label mb-3 text-ink-3">Internamente</p>
                          <ul className="grid gap-1.5 text-[12.5px] leading-snug">
                            {step.internal.map((l, i) => (
                              <li
                                key={i}
                                className={`transition-all duration-500 ${t >= l.at ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"} ${LOG_TONE[l.tone ?? "default"]}`}
                              >
                                {l.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {last && (
                        <div className="mt-auto grid gap-2 pt-6">
                          <button type="button" onClick={restart} className="btn btn-ghost h-11 justify-center">
                            <RotateCcw size={15} aria-hidden /> Repetir el caso
                          </button>
                          <button type="button" onClick={onClose} className="btn btn-primary h-11 justify-center">
                            Volver a la exposición
                          </button>
                          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-3">{PHOTO_CREDITS}</p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {!last && (
                    <div className="pt-5">
                      <div className="h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                        <div className="h-full rounded-full bg-blue-2 transition-[width] duration-100 ease-linear" style={{ width: `${Math.min(100, (t / step.duration) * 100)}%` }} />
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="btn btn-ghost h-10 px-4 text-[13px] disabled:opacity-30">
                          <ArrowLeft size={14} aria-hidden /> Anterior
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlaying((p) => !p)}
                          aria-label={playing ? "Pausar" : "Reanudar"}
                          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--hairline-strong)] text-ink-2 transition-colors hover:text-ink"
                        >
                          {playing ? <Pause size={15} /> : <Play size={15} />}
                        </button>
                        <button type="button" onClick={() => go(index + 1)} className="btn btn-ghost h-10 px-4 text-[13px]">
                          Siguiente <ArrowRight size={14} aria-hidden />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 flex items-center gap-2 text-[11px] text-ink-3">
                <Lotus className="h-4 w-4 text-[#9BD06B]" /> THAI·NOW es un restaurante inventado para este caso.
              </div>
            </aside>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
