/** Autocompletado con Tab: comandos, rutas del sistema de archivos y opciones conocidas. */
import { MODES } from "@/lib/constants";
import { COMMAND_NAMES, LAB_SECTIONS } from "./commandRegistry";
import { PALETTE } from "./terminalTheme";
import { isDir, listDir, lookup, resolvePath } from "./virtualFs";

export interface Completion {
  value: string;
  /** Varias coincidencias sin prefijo común que extender: se listan como en bash. */
  suggestions: string[];
}

const OPTIONS: Record<string, string[]> = {
  uname: ["-a", "-m", "-n", "-r", "-s"],
  lsb_release: ["-a", "-c", "-d", "-r"],
  free: ["-h", "-m"],
  hostname: ["-I"],
  strace: ["ls"],
  simulation: ["mode", "pause", "resume", "speed", "start", "step", "stop"],
  log: ["10", "30"],
  top: ["-p"],
  kill: ["-9", "-CONT", "-STOP", "-TERM", "-l"],
  ps: ["-ef", "-f", "-p", "aux"],
  pstree: ["-p"],
  jobs: ["-l", "-p"],
  lab: LAB_SECTIONS,
  theme: ["reset", ...PALETTE.map((c) => c.aliases[0].replace(" ", "-"))],
};

function commonPrefix(words: string[]): string {
  return words.reduce((acc, w) => {
    let i = 0;
    while (i < acc.length && acc[i] === w[i]) i++;
    return acc.slice(0, i);
  });
}

function pathCandidates(current: string, cwd: string, dirsOnly: boolean): string[] {
  const slash = current.lastIndexOf("/");
  const dirPart = slash >= 0 ? current.slice(0, slash + 1) : "";
  const base = slash >= 0 ? current.slice(slash + 1) : current;
  const node = lookup(resolvePath(dirPart || ".", cwd));
  if (!node || node.type !== "dir" || node.restricted) return [];
  return listDir(node, base.startsWith("."))
    .filter((name) => !dirsOnly || isDir(resolvePath(dirPart + name, cwd)))
    .map((name) => dirPart + name + (isDir(resolvePath(dirPart + name, cwd)) ? "/" : ""));
}

export function complete(input: string, cwd: string): Completion {
  const endsWithSpace = /\s$/.test(input);
  const parts = input.trimStart().split(/\s+/).filter(Boolean);
  const index = endsWithSpace ? parts.length : Math.max(0, parts.length - 1);
  const current = endsWithSpace ? "" : (parts[parts.length - 1] ?? "");
  const command = parts[0];

  let candidates: string[];
  if (index === 0 || (command === "sudo" && index === 1)) candidates = COMMAND_NAMES;
  else if (command === "simulation" && parts[1] === "mode" && index === 2) candidates = MODES.map((m) => m.id);
  else if (OPTIONS[command] && index === 1) candidates = OPTIONS[command];
  else candidates = pathCandidates(current, cwd, command === "cd");

  const matches = candidates.filter((c) => c.startsWith(current));
  if (!matches.length) return { value: input, suggestions: [] };

  const head = input.slice(0, input.length - current.length);
  if (matches.length === 1) {
    const m = matches[0];
    return { value: head + m + (m.endsWith("/") ? "" : " "), suggestions: [] };
  }
  const prefix = commonPrefix(matches);
  if (prefix.length > current.length) return { value: head + prefix, suggestions: [] };
  return { value: input, suggestions: matches.map((m) => m.replace(/\/$/, "").split("/").pop() + (m.endsWith("/") ? "/" : "")) };
}
