/**
 * Sistema de archivos de la máquina: los directorios y archivos que usa la exposición.
 * No existe ninguna relación con el sistema de archivos real del servidor ni del usuario.
 */
import { interrupts, osRelease } from "./debianOutputs";
import { HOME, debianSystem as S } from "./debianSystem";
import type { Proc } from "./processes/machine";
import { procStatus } from "./processes/procStatus";
import { allProcesses, wchanOf } from "./processes/processView";

type Children = Record<string, VNode>;

export type VNode =
  /** children puede calcularse al leer (/proc cambia con cada proceso). */
  | { type: "dir"; children: Children | (() => Children); restricted?: boolean }
  | { type: "file"; content: () => string; binary?: boolean; size?: number; exec?: boolean };

const dir = (children: Children | (() => Children) = {}, restricted = false): VNode => ({ type: "dir", children, restricted });
const file = (content: () => string, extra: { binary?: boolean; size?: number; exec?: boolean } = {}): VNode => ({ type: "file", content, ...extra });

export const childrenOf = (node: VNode): Children => (node.type !== "dir" ? {} : typeof node.children === "function" ? node.children() : node.children);

const C_SOURCE = `/* Filósofos comensales con orden total de recursos (sin deadlock). */
#include <pthread.h>
#include <stdio.h>

#define N 5
pthread_mutex_t tenedor[N];

void *filosofo(void *arg) {
    int id = *(int *)arg;
    int izq = id, der = (id + 1) % N;
    int primero = izq < der ? izq : der;
    int segundo = izq < der ? der : izq;

    for (;;) {
        /* pensar() */
        pthread_mutex_lock(&tenedor[primero]);
        pthread_mutex_lock(&tenedor[segundo]);
        printf("P%d come\\n", id);
        pthread_mutex_unlock(&tenedor[segundo]);
        pthread_mutex_unlock(&tenedor[primero]);
    }
    return NULL;
}`;

const NOTES = `Exposición · Sistemas Operativos · Grupo 06

Condiciones de Coffman (deben cumplirse las cuatro):
  1. Exclusión mutua
  2. Retención y espera
  3. No expropiación
  4. Espera circular

Estrategias: orden total, limitar concurrencia (N-1), asimétrica.
Probar en esta terminal: philosophers, forks, deadlock, reset.`;

const ZOMBIE_SOURCE = `/* Laboratorio de procesos: provocar un proceso zombi.
 * El hijo termina enseguida; el padre no llama a wait() durante 60 s,
 * así que el hijo queda en estado Z ([zombie] <defunct>) hasta que el padre muere.
 */
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(void) {
    pid_t pid = fork();
    if (pid == 0) {
        printf("Hijo  (PID %d): termino ya\\n", getpid());
        exit(0);
    }
    printf("Padre (PID %d): creé al hijo %d y no llamaré a wait()\\n", getpid(), pid);
    sleep(60);
    return 0;
}`;

/** /proc/<PID>: status, comm y cmdline de cada proceso vivo (el PCB que Linux expone). */
function procChildren(): Children {
  const children: Children = { interrupts: file(interrupts) };
  const live = (p: Proc) => allProcesses().find((q) => q.pid === p.pid) ?? p;
  for (const p of allProcesses()) {
    children[String(p.pid)] = dir({
      status: file(() => procStatus(live(p))),
      comm: file(() => p.comm),
      cmdline: file(() => p.cmd.replace(/ /g, "\u0000")),
      wchan: file(() => {
        const w = wchanOf(live(p));
        return w === "-" ? "0" : w;
      }),
    });
  }
  return children;
}

const BASHRC = `# ~/.bashrc: executed by bash(1) for non-login shells.
case $- in
    *i*) ;;
      *) return;;
esac
HISTCONTROL=ignoreboth
alias ls='ls --color=auto'`;

const PROFILE = `# ~/.profile: executed by the command interpreter for login shells.
if [ -n "$BASH_VERSION" ]; then
    if [ -f "$HOME/.bashrc" ]; then
        . "$HOME/.bashrc"
    fi
fi`;

const ROOT: VNode = dir({
  bin: dir(),
  boot: dir(),
  dev: dir(),
  etc: dir({
    "os-release": file(osRelease),
    hostname: file(() => S.hostname),
  }),
  home: dir({
    [S.username]: dir({
      ".bashrc": file(() => BASHRC),
      ".profile": file(() => PROFILE),
      Desktop: dir(),
      Documents: dir({
        "filosofos_comensales.c": file(() => C_SOURCE),
        "notas_exposicion.txt": file(() => NOTES),
      }),
      Downloads: dir({ "guia_laboratorio_SO.pdf": file(() => "", { binary: true, size: 1284512 }) }),
      laboratorio: dir({
        "zombie.c": file(() => ZOMBIE_SOURCE),
        zombie: file(() => "", { binary: true, size: 16144, exec: true }),
      }),
      Music: dir(),
      Pictures: dir(),
      Public: dir(),
      Templates: dir(),
      Videos: dir(),
    }),
  }),
  lib: dir(),
  lib64: dir(),
  media: dir(),
  mnt: dir(),
  opt: dir(),
  proc: dir(procChildren),
  root: dir({}, true),
  run: dir(),
  sbin: dir(),
  srv: dir(),
  sys: dir(),
  tmp: dir(),
  usr: dir(),
  var: dir(),
});

/** Ruta absoluta normalizada a partir de cwd; admite ~, ., .. */
export function resolvePath(path: string, cwd: string): string {
  let p = path;
  if (p === "~" || p.startsWith("~/")) p = HOME + p.slice(1);
  const parts = (p.startsWith("/") ? p : `${cwd}/${p}`).split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return `/${stack.join("/")}`;
}

export function lookup(abs: string): VNode | null {
  let node: VNode = ROOT;
  for (const part of abs.split("/").filter(Boolean)) {
    const children = childrenOf(node);
    if (node.type !== "dir" || !(part in children)) return null;
    node = children[part];
  }
  return node;
}

/** Entradas de un directorio, ordenadas como `ls` (sin distinguir mayúsculas ni el punto inicial). */
export function listDir(node: VNode, showHidden = false): string[] {
  if (node.type !== "dir") return [];
  const names = Object.keys(childrenOf(node)).filter((n) => showHidden || !n.startsWith("."));
  const key = (n: string) => n.replace(/^\./, "").toLowerCase();
  return names.sort((a, b) => key(a).localeCompare(key(b), "en", { numeric: true }));
}

export const isDir = (abs: string) => lookup(abs)?.type === "dir";

export function fileSize(node: VNode): number {
  if (node.type === "dir") return 4096;
  return node.size ?? new TextEncoder().encode(`${node.content()}\n`).length;
}
