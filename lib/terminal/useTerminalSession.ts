"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { SimulationController } from "@/lib/useSimulation";
import type { StreamStep } from "@/types/terminal";
import { complete } from "./autocomplete";
import { execute } from "./commandRegistry";
import { lsColumns } from "./debianOutputs";
import { debianSystem } from "./debianSystem";
import { foregroundDeathMessage } from "./processCommands";
import { machine } from "./processes/machine";
import { registerSimulation } from "./processes/tableProcesses";
import type { Signal } from "./processes/signals";
import { type InitialScreen, bannerLines, createTerminalState, terminalReducer } from "./terminalState";
import { type SimulationBridge, line } from "./terminalTypes";

/** El usuario no está en sudoers: la contraseña nunca se valida ni se guarda. */
const NOT_SUDOER = `${debianSystem.username} is not in the sudoers file.`;

/** Toda la lógica de la sesión (entrada, historial, salidas en curso) separada de la UI. */
export function useTerminalSession(sim: SimulationController, reduced: boolean, tty: string, screen: InitialScreen = "banner") {
  const [state, dispatch] = useReducer(terminalReducer, { tty, screen }, createTerminalState);
  const [firstNewId] = useState(() => state.nextId);
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const historyIndex = useRef<number | null>(null);
  const draft = useRef("");
  const timers = useRef<number[]>([]);
  const sessionStart = useRef(0);
  const simRef = useRef(sim);
  /** Proceso en primer plano (sleep, fg, ./zombie): la terminal espera a que termine o se detenga. */
  const fgPid = useRef<number | null>(null);

  useEffect(() => {
    simRef.current = sim;
  });
  // Los procesos de la mesa (ps, pstree, /proc) leen el mismo motor que el panel.
  useEffect(() => registerSimulation({ state: () => simRef.current.state, playing: () => simRef.current.playing }), []);
  useEffect(() => {
    sessionStart.current = Date.now();
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const bridge = useMemo<SimulationBridge>(
    () => ({
      getState: () => simRef.current.state,
      isPlaying: () => simRef.current.playing,
      replace: (s) => simRef.current.replace(s),
      play: () => simRef.current.play(),
      pause: () => simRef.current.pause(),
      step: () => simRef.current.stepOnce(),
      reset: (mode) => simRef.current.reset(mode),
      speed: () => simRef.current.speed,
      setSpeed: (x) => simRef.current.setSpeed(x),
    }),
    [],
  );

  const setInput = useCallback((v: string, c = v.length) => {
    setValue(v);
    setCaret(c);
  }, []);

  const cancelStream = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const runStream = useCallback(
    (steps: StreamStep[]) => {
      dispatch({ type: "mode", mode: "busy" });
      let elapsed = 0;
      steps.forEach((step, i) => {
        elapsed += reduced ? Math.min(step.delay, 120) : step.delay;
        timers.current.push(
          window.setTimeout(() => {
            step.effect?.();
            if (step.clear) dispatch({ type: "clear" });
            const shown = step.render ? step.render() : step.lines;
            if (shown?.length) dispatch({ type: "append", lines: shown });
            if (i === steps.length - 1) dispatch({ type: "mode", mode: "input" });
          }, elapsed),
        );
      });
    },
    [reduced],
  );

  /** Fin del proceso en primer plano: mensaje de bash si murió por una señal y avisos de trabajos. */
  const finishForeground = useCallback(
    (signal: Signal | null, stopped: boolean) => {
      const m = machine();
      fgPid.current = null;
      m.setForeground(tty, null);
      const message = stopped ? null : foregroundDeathMessage(signal);
      const notes = m.takeNotes(m.shell(tty)).map((t) => line(t));
      dispatch({ type: "append", lines: [...(message ? [line(message)] : []), ...notes] });
      dispatch({ type: "mode", mode: "input" });
    },
    [tty],
  );

  // La máquina es compartida: otra terminal puede matar este bash o el proceso en primer plano.
  useEffect(() => {
    const m = machine();
    m.session(tty);
    return m.subscribe((e) => {
      if ((e.type === "exit" || e.type === "stop") && e.pid === fgPid.current) {
        finishForeground(e.signal, e.type === "stop");
        return;
      }
      if (e.type !== "shell-exit" || e.tty !== tty || e.signal === null) return;
      fgPid.current = null;
      if (!e.login) {
        // El bash hijo murió: el padre recupera la terminal e informa como bash.
        dispatch({ type: "append", lines: [line(foregroundDeathMessage(e.signal) ?? "")] });
        dispatch({ type: "mode", mode: "input" });
        return;
      }
      // Murió el bash de la pestaña: gnome-terminal lo informa y abre una sesión nueva.
      cancelStream();
      dispatch({ type: "mode", mode: "busy" });
      dispatch({ type: "append", lines: [line(""), line(`The child process was aborted by signal ${e.signal === "KILL" ? "9" : e.signal}. Relaunching…`, "muted")] });
      timers.current.push(
        window.setTimeout(() => {
          machine().session(tty);
          dispatch({ type: "clear" });
          dispatch({ type: "append", lines: bannerLines(tty) });
          dispatch({ type: "mode", mode: "input" });
        }, 1200),
      );
    });
  }, [tty, finishForeground, cancelStream]);

  const run = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      const last = state.history[state.history.length - 1];
      const history = trimmed && !raw.startsWith(" ") && last !== trimmed ? [...state.history, trimmed] : state.history;
      dispatch({ type: "command", input: raw, record: true });
      historyIndex.current = null;
      draft.current = "";

      const result = execute(raw, { cwd: state.cwd, history, sim: bridge, sessionStart: sessionStart.current, tty });
      if (result.kind === "output" && result.lines.length) dispatch({ type: "append", lines: result.lines });
      else if (result.kind === "clear") dispatch({ type: "clear" });
      else if (result.kind === "cd") dispatch({ type: "cwd", cwd: result.cwd });
      else if (result.kind === "stream") runStream(result.steps);
      else if (result.kind === "password") dispatch({ type: "mode", mode: "password", passwordPrompt: result.message });
      else if (result.kind === "foreground") {
        if (result.lines.length) dispatch({ type: "append", lines: result.lines });
        fgPid.current = result.pid;
        dispatch({ type: "mode", mode: "busy" });
        // Pudo terminar en el mismo instante (sleep 0): no hay que esperar ningún evento.
        if (!machine().get(result.pid)) finishForeground(null, false);
      }
    },
    [state.history, state.cwd, bridge, runStream, tty, finishForeground],
  );

  const submit = useCallback(() => {
    if (state.mode === "busy") return;
    if (state.mode === "password") {
      // La contraseña nunca llega a guardarse: solo se cierra la petición.
      dispatch({ type: "append", lines: [line(state.passwordPrompt ?? ""), line(NOT_SUDOER)] });
      dispatch({ type: "mode", mode: "input" });
      return;
    }
    const raw = value;
    setInput("");
    run(raw);
  }, [state.mode, state.passwordPrompt, value, setInput, run]);

  const navigateHistory = useCallback(
    (direction: -1 | 1) => {
      const h = state.history;
      if (!h.length) return;
      if (historyIndex.current === null) {
        if (direction === 1) return;
        draft.current = value;
        historyIndex.current = h.length - 1;
      } else {
        const next = historyIndex.current + direction;
        if (next < 0) return;
        if (next >= h.length) {
          historyIndex.current = null;
          setInput(draft.current);
          return;
        }
        historyIndex.current = next;
      }
      setInput(h[historyIndex.current]);
    },
    [state.history, value, setInput],
  );

  const autocomplete = useCallback((): boolean => {
    if (!value.trim()) return false;
    const result = complete(value, state.cwd);
    if (result.suggestions.length) {
      dispatch({ type: "command", input: value, record: false });
      dispatch({ type: "append", lines: lsColumns(result.suggestions).map((row) => line(row.join(""))) });
    } else setInput(result.value);
    return true;
  }, [value, state.cwd, setInput]);

  const interrupt = useCallback((): boolean => {
    if (fgPid.current !== null) {
      // Ctrl+C: SIGINT al proceso en primer plano (la terminal vuelve cuando termina).
      dispatch({ type: "append", lines: [line("^C", "muted")] });
      machine().signal(fgPid.current, "INT");
    } else if (state.mode === "busy") {
      cancelStream();
      dispatch({ type: "append", lines: [line("^C", "muted")] });
      dispatch({ type: "mode", mode: "input" });
    } else if (state.mode === "password") {
      dispatch({ type: "append", lines: [line(`${state.passwordPrompt ?? ""}^C`)] });
      dispatch({ type: "mode", mode: "input" });
    } else {
      dispatch({ type: "command", input: value, record: false, interrupted: true });
      setInput("");
    }
    return true;
  }, [state.mode, state.passwordPrompt, value, cancelStream, setInput]);

  /** Ctrl+Z: SIGTSTP al proceso en primer plano; queda detenido (T) como trabajo de bash. */
  const suspend = useCallback((): boolean => {
    if (fgPid.current === null) return false;
    dispatch({ type: "append", lines: [line("^Z", "muted")] });
    machine().signal(fgPid.current, "TSTP");
    return true;
  }, []);

  return {
    state,
    suspend,
    firstNewId,
    value,
    caret,
    setValue: setInput,
    setCaret,
    submit,
    run,
    navigateHistory,
    autocomplete,
    interrupt,
    clearScreen: () => dispatch({ type: "clear" }),
    logout: () => state.mode === "input" && !value && run("exit"),
  };
}
