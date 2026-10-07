/**
 * Los procesos de la mesa: mesa-filosofos y sus cinco hijos filosofo-P0 … P4, como los deja
 * `python3 filosofos.py` en Debian. Existen mientras la simulación está en marcha y su estado en
 * el kernel (R, S, T y wchan) se deriva del mismo motor que ven el panel, philosophers y forks.
 */
import { PHILOSOPHER_COUNT } from "@/lib/constants";
import type { SimulationState } from "@/lib/types";
import { debianSystem as S } from "../debianSystem";
import type { Proc } from "./machine";

export const MESA_PID = 2048;
export const PHILOSOPHER_PIDS = Array.from({ length: PHILOSOPHER_COUNT }, (_, i) => MESA_PID + 1 + i);
/** bash de pts/1, la terminal junto al panel de la simulación. */
const PARENT_SHELL = 1788;
const COMMAND = "python3 filosofos.py";

interface Source {
  state: () => SimulationState;
  playing: () => boolean;
}

let source: Source | null = null;
let startedAt: number | null = null;

/** La sesión de la terminal conecta el motor compartido de la página. */
export function registerSimulation(s: Source) {
  source = s;
}

export function tableActive(): boolean {
  const active = source !== null && (source.state().status !== "idle" || source.playing());
  if (!active) startedAt = null;
  else startedAt ??= Date.now();
  return active;
}

export const isTablePid = (pid: number) => pid === MESA_PID || PHILOSOPHER_PIDS.includes(pid);

/** Estado del proceso de un filósofo según el kernel: letra de estado y dónde duerme. */
export function philosopherKernel(id: number): { state: string; wchan: string } {
  if (!source) return { state: "S", wchan: "hrtimer_nanosleep" };
  const s = source.state();
  if (s.status === "deadlock") return { state: "S", wchan: "futex_wait_queue" };
  if (!source.playing()) return { state: "T", wchan: "do_signal_stop" };
  const p = s.philosophers[id];
  if (p.state === "waiting" || p.state === "blocked") return { state: "S", wchan: "futex_wait_queue" };
  if (p.state === "hungry") return { state: "R", wchan: "-" };
  return { state: "S", wchan: "hrtimer_nanosleep" };
}

/** Los seis procesos (vacío si la simulación no ha arrancado). `bootAt`: arranque de la máquina. */
export function tableProcesses(bootAt: number): Proc[] {
  if (!tableActive()) return [];
  const started = (startedAt ?? Date.now()) - bootAt;
  const base = {
    user: S.username,
    cmd: COMMAND,
    tty: "pts/1",
    flags: "",
    threads: 1,
    tids: [],
    started,
    cpuTime: 0,
    kernel: false,
    protected: false,
    kind: "program" as const,
    reaps: true,
  };
  return [
    { ...base, pid: MESA_PID, ppid: PARENT_SHELL, comm: "mesa-filosofos", state: "S", wchan: "wait_woken", vsz: 36412, rss: 17280, cpu: 0 },
    ...PHILOSOPHER_PIDS.map((pid, i) => {
      const { state, wchan } = philosopherKernel(i);
      return { ...base, pid, ppid: MESA_PID, comm: `filosofo-P${i}`, state, wchan, vsz: 36412, rss: 12928, cpu: 0 };
    }),
  ];
}
