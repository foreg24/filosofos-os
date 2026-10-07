/**
 * Código de validacion/filosofos.py tal cual (lo que muestran `cat` y `less` en ~/validacion).
 * Si cambia el script, regenerar este archivo con el mismo contenido.
 */
export const FILOSOFOS_SOURCE = `#!/usr/bin/env python3
"""
Filósofos comensales con procesos reales de Linux.

Cada filósofo es un proceso del sistema operativo (fork) y cada tenedor un semáforo del
kernel. El deadlock no se dibuja: los cinco procesos quedan dormidos de verdad esperando un
semáforo que nadie va a liberar, y se puede comprobar con ps, top o /proc.

La consola funciona como la terminal de la página: philosophers, forks, simulation, deadlock y
reset. Cualquier otro comando (ps, pstree, top, kill, cat /proc/...) se ejecuta en bash real.

Uso:   python3 filosofos.py
Solo requiere Python 3 (sin paquetes extra). Probado para Debian / Linux.
"""
import collections
import ctypes
import ctypes.util
import getpass
import glob
import multiprocessing as mp
import os
import queue
import random
import signal
import socket
import subprocess
import sys
import threading
import time
import warnings

try:
    import readline
except ImportError:  # pragma: no cover
    readline = None

N = 5
SEATS = N - 1
THINKING, HUNGRY, HOLDING, WAITING, EATING = range(5)
STATE_NAMES = ["THINKING", "HUNGRY", "HOLDING", "WAITING", "EATING"]
# waiting[i]: tenedor pedido (>= 0), o uno de estos valores especiales
NOTHING, ROOM, NEIGHBOURS = -1, -2, -3

MODES = {
    "normal": "naive protocol, random timing",
    "deadlock": "naive protocol, synchronized start",
    "ordered": "total order of resources",
    "limited": "N-1 semaphore",
    "asymmetric": "asymmetric acquisition",
    "monitor": "both forks or none, monitor",
}
KERNEL_STATES = {"R": "running", "S": "sleeping", "D": "disk sleep", "T": "stopped", "t": "traced", "Z": "zombie", "I": "idle"}

# Con varios hilos en el proceso padre, Python avisa que fork() es delicado. Los hijos solo usan
# objetos nuevos, creados justo antes del fork, así que el aviso no aplica aquí.
warnings.filterwarnings("ignore", category=DeprecationWarning)
ctx = mp.get_context("fork")


class C:
    """Colores ANSI (se apagan si la salida no es una terminal)."""
    on = sys.stdout.isatty()
    reset = "\\033[0m" if on else ""
    bold = "\\033[1m" if on else ""
    dim = "\\033[2m" if on else ""
    red = "\\033[1;31m" if on else ""
    green = "\\033[1;32m" if on else ""
    yellow = "\\033[33m" if on else ""
    blue = "\\033[1;34m" if on else ""
    cyan = "\\033[36m" if on else ""


STATE_COLOR = {"THINKING": C.dim, "HUNGRY": "", "HOLDING": C.cyan, "WAITING": C.yellow, "EATING": C.green, "BLOCKED": C.red, "STOPPED": C.yellow}


def set_process_name(name):
    """Nombre del proceso para ps, top y pstree (prctl PR_SET_NAME, máximo 15 caracteres)."""
    try:
        libc = ctypes.CDLL(ctypes.util.find_library("c") or "libc.so.6", use_errno=True)
        libc.prctl(15, name.encode()[:15], 0, 0, 0)
    except Exception:
        pass


def kernel_state(pid):
    """Estado del proceso según el kernel (/proc/PID/stat) y dónde está dormido (/proc/PID/wchan)."""
    try:
        with open(f"/proc/{pid}/stat") as f:
            data = f.read()
        letter = data[data.rfind(")") + 2]
    except (OSError, IndexError):
        return "?", ""
    try:
        with open(f"/proc/{pid}/wchan") as f:
            wchan = f.read().strip()
    except OSError:
        wchan = ""
    return letter, "" if wchan == "0" else wchan


# --------------------------------------------------------------------------- mesa compartida


class Shared:
    """Todo lo que comparten los procesos: semáforos reales y una tabla para poder observarlos."""

    def __init__(self):
        self.state = ctx.RawArray("i", N)
        self.waiting = ctx.RawArray("i", [NOTHING] * N)
        self.holder = ctx.RawArray("i", [-1] * N)
        self.meals = ctx.RawArray("i", N)
        self.in_room = ctx.RawArray("i", N)
        self.forks = [ctx.Lock() for _ in range(N)]          # un semáforo binario por tenedor
        self.room = ctx.Semaphore(SEATS)                       # estrategia 02: la sala admite N - 1
        self.mutex = ctx.Lock()                                # estrategia 04: exclusión del monitor
        self.can_eat = [ctx.Semaphore(0) for _ in range(N)]    # estrategia 04: una condición por filósofo
        self.mstate = ctx.RawArray("i", N)
        self.barrier = ctx.Barrier(N)
        self.events = ctx.Queue()


def monitor_test(sh, k):
    """Entrega los dos tenedores a k solo si tiene hambre y ninguno de sus vecinos está comiendo."""
    left, right = (k + N - 1) % N, (k + 1) % N
    if sh.mstate[k] == HUNGRY and sh.mstate[left] != EATING and sh.mstate[right] != EATING:
        sh.mstate[k] = EATING
        sh.holder[k] = k
        sh.holder[(k + 1) % N] = k
        sh.can_eat[k].release()


def philosopher(i, mode, sh, speed, seed):
    """Cuerpo de cada proceso hijo: pensar, tener hambre, tomar tenedores, comer, soltar."""
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    set_process_name(f"filosofo-P{i}")
    rnd = random.Random(seed * 31 + i)
    left, right = i, (i + 1) % N

    def log(text):
        sh.events.put((time.time(), text))

    def nap(a, b):
        time.sleep(rnd.uniform(a, b) / speed)

    def take(f):
        if not sh.forks[f].acquire(block=False):
            owner = sh.holder[f]
            sh.waiting[i] = f
            sh.state[i] = WAITING
            log(f"P{i} espera F{f}" + (f" · retenido por P{owner}" if owner >= 0 else ""))
            sh.forks[f].acquire()  # aquí el proceso se duerme en el kernel hasta que le den el tenedor
            sh.waiting[i] = NOTHING
        sh.holder[f] = i

    if mode == "ordered":
        first, second = min(left, right), max(left, right)
    elif mode == "asymmetric":
        first, second = (left, right) if i % 2 == 0 else (right, left)
    else:
        first, second = left, right

    first_round = mode != "normal"
    while True:
        sh.state[i] = THINKING
        if first_round:
            sh.barrier.wait()  # todos con hambre en el mismo instante: el peor caso
        else:
            nap(1.5, 4.0)
        sh.state[i] = HUNGRY
        log(f"P{i} tiene hambre")

        if mode == "monitor":
            with sh.mutex:
                sh.mstate[i] = HUNGRY
                monitor_test(sh, i)
                if sh.mstate[i] != EATING:
                    sh.state[i] = WAITING
                    sh.waiting[i] = NEIGHBOURS
                    log(f"P{i} espera sin tomar nada · un vecino está comiendo")
            sh.can_eat[i].acquire()
            sh.waiting[i] = NOTHING
            sh.state[i] = EATING
            log(f"P{i} toma F{left} y F{right} a la vez · come")
        else:
            if mode == "limited":
                if not sh.room.acquire(block=False):
                    sh.state[i] = WAITING
                    sh.waiting[i] = ROOM
                    log(f"P{i} espera turno · sala llena")
                    sh.room.acquire()
                    sh.waiting[i] = NOTHING
                sh.in_room[i] = 1
                log(f"P{i} entra a la sala · {sum(sh.in_room)}/{SEATS}")
            take(first)
            sh.state[i] = HOLDING
            log(f"P{i} toma F{first}")
            if mode == "deadlock":
                time.sleep(0.6 / speed)  # la ventana entre el primer y el segundo tenedor
            elif mode == "normal":
                nap(0.0, 0.8)
            take(second)
            sh.state[i] = EATING
            log(f"P{i} toma F{second} · come")

        nap(1.0, 2.0)
        sh.meals[i] += 1

        if mode == "monitor":
            with sh.mutex:
                sh.mstate[i] = THINKING
                sh.holder[left] = -1
                sh.holder[right] = -1
                monitor_test(sh, (i + N - 1) % N)
                monitor_test(sh, (i + 1) % N)
        else:
            for f in (second, first):
                sh.holder[f] = -1
                sh.forks[f].release()
            if mode == "limited":
                sh.in_room[i] = 0
                sh.room.release()
        log(f"P{i} libera F{left} y F{right}")
        first_round = False


# --------------------------------------------------------------------------- controlador


class Table:
    """Lanza los procesos, recoge sus eventos y revisa el grafo de espera como un detector."""

    def __init__(self):
        self.mode = "deadlock"
        self.speed = 1.0
        self.sh = Shared()
        self.procs = []
        self.status = "idle"
        self.paused = False
        self.cycle = None
        self.started = None
        self.resolved = False
        self.events = collections.deque(maxlen=300)
        self.quiet = False
        self.notify = None
        threading.Thread(target=self._collect, daemon=True).start()
        threading.Thread(target=self._detect, daemon=True).start()

    # -- ciclo de vida
    def pids(self):
        return [p.pid for p in self.procs]

    def start(self):
        self.stop()
        self.sh = Shared()
        seed = int(time.time())
        self.procs = [ctx.Process(target=philosopher, args=(i, self.mode, self.sh, self.speed, seed), name=f"filosofo-P{i}", daemon=True)
                      for i in range(N)]
        for p in self.procs:
            p.start()
        self.status, self.paused, self.cycle, self.resolved = "running", False, None, False
        self.started = time.time()
        self.events.clear()
        os.environ["FILOSOFOS"] = ",".join(str(pid) for pid in self.pids())
        os.environ["MESA"] = str(os.getpid())

    def stop(self):
        for p in self.procs:
            if p.is_alive():
                try:
                    os.kill(p.pid, signal.SIGCONT)
                except ProcessLookupError:
                    pass
                p.terminate()
        for p in self.procs:
            p.join(1)
            if p.is_alive():
                p.kill()
                p.join(1)
        self.procs = []
        self.status, self.paused, self.cycle = "idle", False, None
        self.sh = Shared()
        os.environ.pop("FILOSOFOS", None)
        os.environ.pop("MESA", None)

    def signal_all(self, sig):
        for pid in self.pids():
            try:
                os.kill(pid, sig)
            except ProcessLookupError:
                pass

    # -- hilos del padre
    def _collect(self):
        while True:
            sh = self.sh
            try:
                stamp, text = sh.events.get(timeout=0.2)
            except (queue.Empty, OSError, EOFError, ValueError):
                continue
            if sh is self.sh and self.started:
                self.events.append((stamp - self.started, text))

    def wait_edges(self):
        sh, edges = self.sh, []
        for p in range(N):
            f = sh.waiting[p]
            if f >= 0:
                owner = sh.holder[f]
                if owner >= 0 and owner != p:
                    edges.append((p, owner, f))
        return edges

    @staticmethod
    def find_cycle(edges):
        nxt = {a: b for a, b, _ in edges}
        for start in nxt:
            path, seen, node = [], {}, start
            while node in nxt and node not in seen:
                seen[node] = len(path)
                path.append(node)
                node = nxt[node]
            if node in seen:
                cyc = path[seen[node]:]
                k = cyc.index(min(cyc))
                return cyc[k:] + cyc[:k]
        return None

    def _detect(self):
        last, stable = None, 0
        while True:
            time.sleep(0.25)
            if self.status != "running" or self.paused:
                last, stable = None, 0
                continue
            cyc = self.find_cycle(self.wait_edges())
            stable = stable + 1 if cyc and cyc == last else 0
            last = cyc
            if cyc and stable >= 4:  # el mismo ciclo durante un segundo: nadie se ha movido
                self.cycle, self.status = cyc, "deadlock"
                now = time.time() - self.started
                self.events.append((now, f"Ciclo detectado: {fmt_cycle(cyc)}"))
                self.events.append((now, "DEADLOCK · ningún proceso puede continuar"))
                if self.notify and not self.quiet:
                    self.notify(f"{C.red}[detector] DEADLOCK: {fmt_cycle(cyc)}{C.reset} · escribe 'philosophers' o 'deadlock'")
            if self.mode not in ("normal", "deadlock") and not self.resolved and all(self.sh.meals[i] > 0 for i in range(N)):
                self.resolved = True
                self.events.append((time.time() - self.started, "Los 5 procesos completaron su sección crítica · sin ciclo"))


def fmt_cycle(cyc):
    return " → ".join(f"P{p}" for p in cyc + cyc[:1])


# --------------------------------------------------------------------------- comandos

table = Table()


def visual_state(i):
    sh = table.sh
    if not table.procs:
        return "THINKING"
    if table.cycle and i in table.cycle:
        return "BLOCKED"
    if table.paused:
        return "STOPPED"
    return STATE_NAMES[sh.state[i]]


def paint(text, width, name):
    return f"{STATE_COLOR.get(name, '')}{text:<{width}}{C.reset}"


def cmd_philosophers(_args):
    sh = table.sh
    print(f"{C.bold}{'PROC':<6}{'PID':<8}{'STATE':<11}{'HOLDS':<9}{'WAITS FOR':<17}KERNEL (/proc){C.reset}")
    for i in range(N):
        pid = table.procs[i].pid if table.procs else None
        name = visual_state(i)
        held = ",".join(f"F{f}" for f in range(N) if sh.holder[f] == i) or "—"
        w = sh.waiting[i]
        if w >= 0:
            owner = sh.holder[w]
            waits = f"F{w}" + (f" (P{owner})" if owner >= 0 else "")
        elif w == ROOM:
            waits = "turno de sala"
        elif w == NEIGHBOURS:
            waits = "vecinos (monitor)"
        else:
            waits = "—"
        if pid:
            letter, wchan = kernel_state(pid)
            kernel = f"{letter} {KERNEL_STATES.get(letter, '')}" + (f" · {wchan}" if wchan else "")
        else:
            kernel = "—"
        print(f"{'P' + str(i):<6}{str(pid or '—'):<8}{paint(name, 11, name)}{C.dim}{held:<9}{waits:<17}{kernel}{C.reset}")
    if not table.procs:
        print(f"{C.dim}Sin procesos en ejecución. Usa 'simulation start' o 'deadlock'.{C.reset}")


def cmd_forks(_args):
    sh = table.sh
    print(f"{C.bold}{'FORK':<6}{'STATE':<9}{'HOLDER':<8}REQUESTED BY{C.reset}")
    for f in range(N):
        owner = sh.holder[f]
        asking = ",".join(f"P{p}" for p in range(N) if sh.waiting[p] == f) or "—"
        if owner < 0:
            st, color = "FREE", C.dim
        elif table.cycle and owner in table.cycle:
            st, color = "BLOCKED", C.red
        else:
            st, color = "HELD", C.cyan
        print(f"{'F' + str(f):<6}{color}{st:<9}{C.reset}{C.dim}{('P' + str(owner)) if owner >= 0 else '—':<8}{asking}{C.reset}")


def status_lines():
    sh = table.sh
    st = table.status.upper() + (" (paused · SIGSTOP)" if table.paused else "")
    color = C.red if table.status == "deadlock" else C.green if table.status == "running" else ""
    edges = table.wait_edges()
    out = [
        f"{C.bold}Dining philosophers · real Linux processes{C.reset}",
        f"  status   {color}{st}{C.reset}",
        f"  mode     {table.mode} ({MODES[table.mode]})",
        f"  speed    {table.speed:g}x",
        f"  uptime   {time.time() - table.started:.1f} s" if table.procs else "  uptime   —",
        f"  meals    {sum(sh.meals)}",
        f"  waits    {'  '.join(f'P{a}→P{b}' for a, b, _ in edges) or 'none'}",
    ]
    if table.mode == "limited":
        out.append(f"  sala     {sum(sh.in_room)}/{SEATS}")
    if table.cycle:
        out.append(f"  {C.red}cycle    {fmt_cycle(table.cycle)}{C.reset}")
    out.append(f"  pids     {' '.join(map(str, table.pids())) or '—'}")
    return out


def cmd_simulation(args):
    if not args:
        print("\\n".join(status_lines()))
        print(f"\\n{C.dim}Usage: simulation [start|pause|resume|stop|mode <{'|'.join(MODES)}>|speed <0.5|1|2>]{C.reset}")
        return
    sub = args[0]
    if sub == "start":
        if table.status == "deadlock":
            print(f"{C.yellow}simulation: system is deadlocked. Run 'reset' first.{C.reset}")
            return
        if table.procs:
            print("simulation: already running.")
            return
        table.start()
        print(f"{C.cyan}Simulation running · mode {table.mode} · PIDs {' '.join(map(str, table.pids()))}{C.reset}")
    elif sub == "pause":
        if not table.procs:
            print("simulation: not running.")
            return
        table.signal_all(signal.SIGSTOP)
        table.paused = True
        print("Simulation paused · SIGSTOP enviado a los 5 procesos (estado T en ps).")
    elif sub in ("resume", "continue"):
        table.signal_all(signal.SIGCONT)
        table.paused = False
        print("Simulation resumed · SIGCONT.")
    elif sub == "stop":
        table.stop()
        print("Simulation stopped · procesos terminados.")
    elif sub == "mode":
        if len(args) < 2 or args[1] not in MODES:
            print(f"{C.red}simulation: mode must be one of: {', '.join(MODES)}{C.reset}")
            return
        table.stop()
        table.mode = args[1]
        print(f"Mode set to {table.mode} ({MODES[table.mode]}). 5 processes THINKING.")
    elif sub == "speed":
        try:
            table.speed = max(0.1, float(args[1]))
            print(f"Speed {table.speed:g}x (se aplica en el próximo 'simulation start').")
        except (IndexError, ValueError):
            print("Usage: simulation speed <0.5|1|2>")
    elif sub == "step":
        print("simulation: 'step' no aplica aquí; los procesos son reales y los planifica el kernel. Usa 'pause' y 'resume'.")
    else:
        print(f"{C.red}simulation: unknown subcommand '{sub}'{C.reset}")


def cmd_reset(_args):
    table.stop()
    print(f"Simulation reset · mode {table.mode} · 5 processes THINKING · 5 forks FREE")


def print_event(t, text):
    color = C.red if ("DEADLOCK" in text or "Ciclo" in text) else C.yellow if "espera" in text else C.green if "come" in text else C.dim
    print(f"  {C.dim}t={t:6.2f}s{C.reset}  {color}{text}{C.reset}")


def cmd_deadlock(_args):
    table.mode = "deadlock"
    table.quiet = True
    try:
        table.start()
        print()
        print(f"{C.bold}Analyzing resource graph...{C.reset}  {C.dim}(PIDs {' '.join(map(str, table.pids()))}){C.reset}")
        shown, limit = 0, time.time() + 15
        while table.status != "deadlock" and time.time() < limit:
            time.sleep(0.1)
            events = list(table.events)
            for t, text in events[shown:]:
                if "Ciclo" not in text and "DEADLOCK" not in text:
                    print_event(t, text)
            shown = len(events)
        if table.status != "deadlock":
            print(f"{C.yellow}No se formó el ciclo esta vez (el kernel intercaló distinto). Intenta 'deadlock' de nuevo.{C.reset}")
            return
        print(f"\\nCircular wait detected.\\n{C.red}{fmt_cycle(table.cycle)}{C.reset}\\n")
        print(f"{C.red}DEADLOCK DETECTED{C.reset}\\n")
        print(f"{C.bold}Evidencia del kernel{C.reset} {C.dim}(/proc/PID/stat y /proc/PID/wchan){C.reset}")
        print(f"{C.bold}  {'PID':<8}{'STAT':<6}{'WCHAN':<24}COMMAND{C.reset}")
        for i, pid in enumerate(table.pids()):
            letter, wchan = kernel_state(pid)
            print(f"  {pid:<8}{letter:<6}{wchan or '—':<24}filosofo-P{i}")
        print(f"\\n{C.dim}All 5 processes hold one fork and wait for the next. None can proceed.")
        print("Siguen vivos, pero dormidos (S) en el kernel esperando un semáforo que nadie va a liberar.")
        print("Compruébalo:  ps -o pid,stat,wchan:22,comm -p $FILOSOFOS    o    pstree -p $MESA")
        print(f"Run 'reset' to restart the simulation.{C.reset}")
    finally:
        table.quiet = False


def cmd_watch(_args):
    if not table.procs:
        print("watch: no hay procesos. Usa 'simulation start' o 'deadlock' primero.")
        return
    table.quiet = True
    try:
        while True:
            sys.stdout.write("\\033[H\\033[2J")
            print(f"{C.dim}watch · cada 0.5 s · Ctrl+C para salir{C.reset}\\n")
            print("\\n".join(status_lines()))
            print()
            cmd_philosophers([])
            print()
            cmd_forks([])
            print(f"\\n{C.bold}Últimos eventos{C.reset}")
            for t, text in list(table.events)[-8:]:
                print_event(t, text)
            sys.stdout.flush()
            time.sleep(0.5)
    except KeyboardInterrupt:
        print()
    finally:
        table.quiet = False


def cmd_log(args):
    count = int(args[0]) if args and args[0].isdigit() else 30
    events = list(table.events)[-count:]
    if not events:
        print("Sin eventos todavía.")
    for t, text in events:
        print_event(t, text)


def cmd_help(_args):
    groups = [
        ("Dining Philosophers (procesos reales)", [
            ("philosophers", "los 5 procesos: PID, estado, tenedores y estado en el kernel"),
            ("forks", "los 5 tenedores (semáforos): libre, retenido o bloqueado"),
            ("simulation", "estado del sistema"),
            ("simulation mode <m>", f"modos: {', '.join(MODES)}"),
            ("simulation start", "lanza los 5 procesos con el modo actual"),
            ("simulation pause | resume", "SIGSTOP / SIGCONT a los 5 procesos"),
            ("simulation speed <x>", "0.5, 1 o 2"),
            ("deadlock", "provoca el deadlock en vivo y muestra la evidencia del kernel"),
            ("watch", "tablero en vivo (Ctrl+C para salir)"),
            ("log [n]", "últimos eventos"),
            ("reset", "termina los procesos y deja la mesa limpia"),
        ]),
        ("Para comprobarlo con el sistema", [
            ("ps -o pid,stat,wchan:22,comm -p $FILOSOFOS", "estado real de los 5 procesos"),
            ("pstree -p $MESA", "el árbol: esta consola y sus 5 hijos"),
            ("top -p $FILOSOFOS", "los 5 procesos en top"),
            ("cat /proc/<PID>/status", "el PCB de un filósofo"),
            ("kill -9 <PID>", "matar a un filósofo"),
        ]),
    ]
    for i, (title, cmds) in enumerate(groups):
        print(("\\n" if i else "") + f"{C.bold}{title}:{C.reset}\\n")
        for c, d in cmds:
            print(f"  {c:<44}{C.dim}{d}{C.reset}")
    print(f"\\n{C.dim}Cualquier otro comando se ejecuta en bash real (ls, ps, top, uname -a, neofetch...).")
    print(f"exit o Ctrl+D para salir (termina los procesos).{C.reset}")


COMMANDS = {
    "philosophers": cmd_philosophers,
    "forks": cmd_forks,
    "simulation": cmd_simulation,
    "deadlock": cmd_deadlock,
    "reset": cmd_reset,
    "watch": cmd_watch,
    "log": cmd_log,
    "help": cmd_help,
}


# --------------------------------------------------------------------------- consola


def prompt(raw=False):
    user, host = getpass.getuser(), socket.gethostname().split(".")[0]
    cwd = os.getcwd()
    home = os.path.expanduser("~")
    if cwd == home or cwd.startswith(home + os.sep):
        cwd = "~" + cwd[len(home):]
    sign = "#" if os.geteuid() == 0 else "$"
    if raw or not C.on:
        return f"{user}@{host}:{cwd}{sign} "
    # \\001 y \\002 le dicen a readline qué partes no ocupan espacio en pantalla
    return f"\\001{C.green}\\002{user}@{host}\\001{C.reset}\\002:\\001{C.blue}\\002{cwd}\\001{C.reset}\\002{sign} "


def notify(message):
    """Mensaje asíncrono del detector sin romper la línea que el usuario está escribiendo."""
    buffer = readline.get_line_buffer() if readline else ""
    visible = prompt().replace("\\001", "").replace("\\002", "")
    sys.stdout.write(f"\\r\\033[K{message}\\n{visible}{buffer}")
    sys.stdout.flush()


def run_shell(line):
    """Ejecuta el comando en bash real. Ctrl+C le llega a ese comando; la consola sigue viva."""
    child = subprocess.Popen(["/bin/bash", "-c", line])
    while True:
        try:
            child.wait()
            return
        except KeyboardInterrupt:
            continue


def complete(text, state):
    line = readline.get_line_buffer()
    words = line.split()
    if len(words) == 0 or (len(words) == 1 and not line.endswith(" ")):
        options = [c for c in list(COMMANDS) + ["exit", "cd", "clear", "ps", "pstree", "top"] if c.startswith(text)]
    elif words[0] == "simulation" and (len(words) == 1 or (len(words) == 2 and not line.endswith(" "))):
        options = [s for s in ["start", "pause", "resume", "stop", "mode", "speed"] if s.startswith(text)]
    elif words[:2] == ["simulation", "mode"]:
        options = [m for m in MODES if m.startswith(text)]
    else:
        options = glob.glob(os.path.expanduser(text) + "*")
    return options[state] if state < len(options) else None


def banner():
    uname = os.uname()
    pretty = "GNU/Linux"
    try:
        with open("/etc/os-release") as f:
            for row in f:
                if row.startswith("PRETTY_NAME="):
                    pretty = row.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    print(f"{uname.sysname} {uname.nodename} {uname.release} {uname.version} {uname.machine}")
    print(f"{pretty}\\n")
    print(f"{C.bold}Filósofos comensales · procesos reales del sistema operativo{C.reset}")
    print(f"{C.dim}Cada filósofo es un proceso hijo de esta consola (PID {os.getpid()}) y cada tenedor un semáforo del kernel.")
    print(f"Escribe 'help' para ver los comandos. Lo demás (ps, top, pstree, kill...) se ejecuta en bash.{C.reset}\\n")


def main():
    if not sys.platform.startswith("linux"):
        sys.exit("Este script necesita Linux (usa fork, semáforos del kernel y /proc). Córrelo en Debian.")
    set_process_name("mesa-filosofos")
    history = os.path.expanduser("~/.filosofos_history")
    if readline:
        try:
            readline.read_history_file(history)
        except OSError:
            pass
        readline.set_completer(complete)
        readline.set_completer_delims(" \\t")
        readline.parse_and_bind("tab: complete")
    table.notify = notify
    banner()
    try:
        while True:
            try:
                line = input(prompt()).strip()
            except KeyboardInterrupt:
                print("^C")
                continue
            except EOFError:
                print("logout")
                break
            if not line:
                continue
            word, *args = line.split()
            if word in ("exit", "logout"):
                break
            if word == "cd":
                target = os.path.expanduser(args[0] if args else "~")
                try:
                    os.chdir(target)
                except OSError as e:
                    print(f"bash: cd: {target}: {e.strerror}")
                continue
            if word in COMMANDS:
                try:
                    COMMANDS[word](args)
                except KeyboardInterrupt:
                    print("^C")
                continue
            run_shell(line)
    finally:
        table.stop()
        if readline:
            try:
                readline.write_history_file(history)
            except OSError:
                pass


if __name__ == "__main__":
    main()
`;
