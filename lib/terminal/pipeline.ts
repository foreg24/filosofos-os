/**
 * Filtros de texto para tuberías (`ps aux | grep sleep`, `… | awk '{print $8, $11}' | sort | uniq -c`).
 * Son transformaciones de líneas implementadas aquí: no se interpreta ni ejecuta código.
 */
import type { OutputLine, Span } from "@/types/terminal";
import { splitFlags } from "./commandParser";
import { line } from "./terminalTypes";

export type FilterResult = { lines: OutputLine[] } | { error: string };
type Filter = (input: string[], args: string[]) => FilterResult;

const plain = (texts: string[]): OutputLine[] => texts.map((t) => line(t));

/** grep resalta en rojo lo encontrado (alias de Debian: grep --color=auto). */
function highlight(text: string, pattern: string, ignoreCase: boolean): OutputLine {
  if (!pattern) return line(text);
  const hay = ignoreCase ? text.toLowerCase() : text;
  const needle = ignoreCase ? pattern.toLowerCase() : pattern;
  const spans: Span[] = [];
  let from = 0;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) {
    if (i > from) spans.push({ text: text.slice(from, i) });
    spans.push({ text: text.slice(i, i + needle.length), tone: "match" });
    from = i + needle.length;
  }
  if (from < text.length) spans.push({ text: text.slice(from) });
  return { spans: spans.length ? spans : [{ text }] };
}

const grep: Filter = (input, args) => {
  const { flags, long, operands } = splitFlags(args);
  const pattern = operands[0];
  if (pattern === undefined) return { error: "Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information." };
  if (long.some((l) => l !== "color=auto" && l !== "color")) return { error: `grep: unrecognized option '--${long[0]}'` };
  const ignoreCase = flags.has("i");
  const invert = flags.has("v");
  const word = flags.has("w");
  const test = (t: string) => {
    const hay = ignoreCase ? t.toLowerCase() : t;
    const needle = ignoreCase ? pattern.toLowerCase() : pattern;
    if (!word) return hay.includes(needle);
    return hay.split(/[^A-Za-z0-9_]+/).includes(needle);
  };
  const matched = input.filter((t) => test(t) !== invert);
  if (flags.has("c")) return { lines: plain([String(matched.length)]) };
  return { lines: matched.map((t) => (invert ? line(t) : highlight(t, pattern, ignoreCase))) };
};

function countArg(args: string[], fallback: number): number | null {
  const n = args.find((a) => /^-\d+$/.test(a));
  if (n) return Number(n.slice(1));
  const i = args.findIndex((a) => a === "-n");
  if (i >= 0) return /^\d+$/.test(args[i + 1] ?? "") ? Number(args[i + 1]) : null;
  const joined = args.find((a) => /^-n\d+$/.test(a));
  return joined ? Number(joined.slice(2)) : fallback;
}

const head: Filter = (input, args) => {
  const n = countArg(args, 10);
  return n === null ? { error: "head: invalid number of lines" } : { lines: plain(input.slice(0, n)) };
};

const tail: Filter = (input, args) => {
  const n = countArg(args, 10);
  return n === null ? { error: "tail: invalid number of lines" } : { lines: plain(n ? input.slice(-n) : []) };
};

const sort: Filter = (input, args) => {
  const { flags } = splitFlags(args);
  const numeric = flags.has("n");
  const sorted = [...input].sort((a, b) => (numeric ? (parseFloat(a) || 0) - (parseFloat(b) || 0) : a.localeCompare(b, "en")));
  if (flags.has("r")) sorted.reverse();
  return { lines: plain(flags.has("u") ? sorted.filter((t, i) => t !== sorted[i - 1]) : sorted) };
};

const uniq: Filter = (input, args) => {
  const { flags } = splitFlags(args);
  const groups: [string, number][] = [];
  for (const t of input) {
    const last = groups[groups.length - 1];
    if (last && last[0] === t) last[1]++;
    else groups.push([t, 1]);
  }
  return { lines: plain(groups.map(([t, n]) => (flags.has("c") ? `${String(n).padStart(7)} ${t}` : t))) };
};

const wc: Filter = (input, args) => {
  const { flags } = splitFlags(args);
  const linesCount = input.length;
  const words = input.reduce((n, t) => n + t.split(/\s+/).filter(Boolean).length, 0);
  const bytes = input.reduce((n, t) => n + new TextEncoder().encode(`${t}\n`).length, 0);
  if (flags.has("l")) return { lines: plain([String(linesCount)]) };
  if (flags.has("w")) return { lines: plain([String(words)]) };
  return { lines: plain([`${String(linesCount).padStart(7)} ${String(words).padStart(7)} ${String(bytes).padStart(7)}`]) };
};

/** awk mínimo: solo `{print $N, $M…}` (el uso del laboratorio). */
const awk: Filter = (input, args) => {
  const program = args.find((a) => !a.startsWith("-")) ?? "";
  const m = program.match(/^\s*\{\s*print\s*(.*?)\s*;?\s*\}\s*$/);
  if (!m) return { error: `awk: cmd. line:1: ${program}\nawk: cmd. line:1: syntax error` };
  const items = m[1] ? m[1].split(/\s*,\s*/) : ["$0"];
  if (!items.every((it) => /^\$(\d+|NF)$/.test(it))) return { error: `awk: cmd. line:1: ${program}\nawk: cmd. line:1: syntax error` };
  return {
    lines: plain(
      input.map((t) => {
        const fields = t.trim().split(/\s+/);
        return items
          .map((it) => {
            const k = it === "$NF" ? fields.length : Number(it.slice(1));
            return k === 0 ? t : (fields[k - 1] ?? "");
          })
          .join(" ");
      }),
    ),
  };
};

const passthrough: Filter = (input) => ({ lines: plain(input) });

export const FILTERS: Record<string, Filter> = { grep, head, tail, sort, uniq, wc, awk, cat: passthrough, less: passthrough, more: passthrough };

/** Cómo se ve cada filtro en la lista de procesos (ps muestra a sus compañeros de tubería). */
export function filterCommandLine(name: string, args: string[]) {
  return [name === "grep" ? "grep --color=auto" : name, ...args].join(" ");
}
