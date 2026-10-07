"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type InitialScreen, promptFor } from "@/lib/terminal/terminalState";
import { DEFAULT_THEME, getTheme, subscribeTheme } from "@/lib/terminal/terminalTheme";
import { useTerminalSession } from "@/lib/terminal/useTerminalSession";
import { useMotionPreference } from "../MotionProvider";
import { useDemoSimulation } from "../SimulationContext";
import { TerminalHeader } from "./TerminalHeader";
import { TerminalInput } from "./TerminalInput";
import { TerminalViewport } from "./TerminalViewport";
import "./terminal.css";

const QUICK = ["lab", "ps aux", "pstree -p", "whoami", "philosophers", "deadlock", "help"];

interface DebianTerminalProps {
  className?: string;
  style?: React.CSSProperties;
  /** Sesión de la terminal: cada instancia es un login distinto sobre la misma máquina. */
  tty?: string;
  /** immersive: ocupa todo su contenedor (la pantalla del portátil) y omite los atajos inferiores. */
  variant?: "default" | "immersive";
  /** Pantalla inicial: inicio de sesión o el neofetch que muestra el portátil. */
  screen?: InitialScreen;
}

/**
 * Terminal Debian: cada comando pasa por el registro explícito de lib/terminal.
 */
export function DebianTerminal({ className = "", style, tty = "pts/0", variant = "default", screen = "banner" }: DebianTerminalProps) {
  const sim = useDemoSimulation();
  const { reduced } = useMotionPreference();
  const session = useTerminalSession(sim, reduced, tty, screen);
  const { state } = session;
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const immersive = variant === "immersive";
  // Color elegido en la paleta: compartido por todas las terminales de la página.
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => DEFAULT_THEME);
  const themeStyle = {
    "--term-accent": theme.accent,
    ...(theme.custom ? { "--term-cursor": theme.accent, "--term-focus": `${theme.accent}80` } : {}),
  } as React.CSSProperties;
  // Pista hasta que el usuario ejecute su primer comando.
  const untouched = state.history.length === (screen === "neofetch" ? 1 : 0);

  // Scroll al final con cada salida nueva (suave salvo movimiento reducido).
  useEffect(() => {
    const el = viewport.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [state.entries, state.mode, reduced]);

  const focusInput = () => input.current?.focus({ preventScroll: true });

  return (
    <div className={className} style={style}>
      <figure className={`term ${immersive ? "is-immersive" : ""}`} style={themeStyle} aria-label="Terminal Debian. Escribe help para ver los comandos.">
        <TerminalHeader cwd={state.cwd} />
        <TerminalViewport
          ref={viewport}
          entries={state.entries}
          firstNewId={session.firstNewId}
          animate={!reduced}
          onActivate={focusInput}
          heightClass={immersive ? "min-h-0 flex-1" : undefined}
        >
          <TerminalInput
            ref={input}
            mode={state.mode}
            prompt={promptFor(state.cwd)}
            passwordPrompt={state.passwordPrompt}
            value={session.value}
            caret={session.caret}
            focused={focused}
            hint={untouched ? "escribe help" : null}
            onValue={session.setValue}
            onCaret={session.setCaret}
            onFocusChange={setFocused}
            onSubmit={session.submit}
            onHistory={session.navigateHistory}
            onComplete={session.autocomplete}
            onClearScreen={session.clearScreen}
            onInterrupt={session.interrupt}
            onSuspend={session.suspend}
            onEof={session.logout}
          />
        </TerminalViewport>
      </figure>

      {!immersive && (
        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <p className="label flex flex-wrap items-center gap-x-4 gap-y-2 text-ink-3">
            <span>Prueba</span>
            {QUICK.map((cmd) => (
              <button
                key={cmd}
                type="button"
                disabled={state.mode !== "input"}
                onClick={() => {
                  focusInput();
                  session.setValue("");
                  session.run(cmd);
                }}
                className="font-mono normal-case tracking-normal text-ink-2 underline decoration-ink-3/40 underline-offset-4 transition-colors hover:text-blue-2 hover:decoration-blue-2 disabled:opacity-40"
              >
                {cmd}
              </button>
            ))}
          </p>
          <p className="max-w-[26rem] text-[12px] leading-relaxed text-ink-3 md:text-right">
            Tab completa · ↑ ↓ historial · Ctrl+L limpia · Ctrl+C interrumpe · Esc sale.
          </p>
        </div>
      )}
    </div>
  );
}
