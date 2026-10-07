/** ls, cd, pwd, cat, echo sobre el sistema de archivos. */
import type { OutputLine } from "@/types/terminal";
import { splitFlags } from "./commandParser";
import { HOME, debianSystem as S } from "./debianSystem";
import { lsColumns } from "./debianOutputs";
import { type CommandHandler, line, lines, out, spans } from "./terminalTypes";
import { type VNode, childrenOf, fileSize, listDir, lookup, resolvePath } from "./virtualFs";

const err = (text: string) => out(line(text, "error"));

function childNode(dirNode: VNode, name: string): VNode | undefined {
  if (name === "." || name === "..") return { type: "dir", children: {} };
  return childrenOf(dirNode)[name];
}

/** Colores de `ls --color=auto`: directorios en azul y ejecutables en verde, en negrita. */
function toneOf(node: VNode | undefined) {
  if (node?.type === "dir") return "dir" as const;
  if (node?.type === "file" && node.exec) return "prompt" as const;
  return undefined;
}

/** Listado en columnas; los directorios en azul, como `ls --color=auto` en Debian. */
export function lsGrid(names: string[], dirNode: VNode): OutputLine[] {
  return lsColumns(names).map((row) =>
    spans(
      ...row.map((cell) => {
        const name = cell.trimEnd();
        return { text: cell, tone: toneOf(childNode(dirNode, name)) };
      }),
    ),
  );
}

function longListing(names: string[], abs: string, dirNode: VNode, sessionStart: number): OutputLine[] {
  const owner = abs.startsWith(HOME) ? S.username : "root";
  const when = new Date(sessionStart - 2 * 3600 * 1000);
  const date = `${when.toLocaleString("en-US", { month: "short" })} ${String(when.getDate()).padStart(2)} ${when.toTimeString().slice(0, 5)}`;
  const rows = names.map((name) => {
    const node = childNode(dirNode, name) ?? dirNode;
    const size = fileSize(node);
    const exec = node.type === "file" && Boolean(node.exec);
    return { name, node, dir: node.type === "dir", exec, size, blocks: Math.ceil(size / 4096) * 4 };
  });
  const width = Math.max(...rows.map((r) => String(r.size).length));
  return [
    line(`total ${rows.reduce((a, r) => a + r.blocks, 0)}`),
    ...rows.map((r) =>
      spans(
        { text: `${r.dir ? "drwxr-xr-x" : r.exec ? "-rwxr-xr-x" : "-rw-r--r--"} ${r.dir ? 2 : 1} ${owner} ${owner} ${String(r.size).padStart(width)} ${date} ` },
        { text: r.name, tone: toneOf(r.node) },
      ),
    ),
  ];
}

const ls: CommandHandler = (args, ctx) => {
  const { flags, operands } = splitFlags(args);
  const invalid = [...flags].find((f) => !"alh1".includes(f));
  if (invalid) return out(line(`ls: invalid option -- '${invalid}'`, "error"), line("Try 'ls --help' for more information."));

  const targets = operands.length ? operands : ["."];
  const result: OutputLine[] = [];
  targets.forEach((target, i) => {
    const abs = resolvePath(target, ctx.cwd);
    const node = lookup(abs);
    if (!node) return result.push(line(`ls: cannot access '${target}': No such file or directory`, "error"));
    if (node.type === "dir" && node.restricted) return result.push(line(`ls: cannot open directory '${target}': Permission denied`, "error"));
    if (targets.length > 1 && node.type === "dir") result.push(line(`${target}:`));

    const names = node.type === "dir" ? [...(flags.has("a") ? [".", ".."] : []), ...listDir(node, flags.has("a"))] : [target];
    const parent = node.type === "dir" ? node : ({ type: "dir", children: { [target]: node } } as VNode);
    if (flags.has("l")) result.push(...longListing(names, abs, parent, ctx.sessionStart));
    // En una tubería, ls escribe una entrada por línea y sin color (como el real).
    else if (ctx.piped) result.push(...names.map((n) => line(n)));
    else if (flags.has("1")) result.push(...names.map((n) => line(n, toneOf(childNode(parent, n)))));
    else result.push(...lsGrid(names, parent));
    if (targets.length > 1 && i < targets.length - 1) result.push(line(""));
  });
  return { kind: "output", lines: result };
};

const cd: CommandHandler = (args, ctx) => {
  if (args.length > 1) return err("bash: cd: too many arguments");
  const target = args[0] ?? "~";
  if (target === "-") return err("bash: cd: OLDPWD not set");
  const abs = resolvePath(target, ctx.cwd);
  const node = lookup(abs);
  if (!node) return err(`bash: cd: ${target}: No such file or directory`);
  if (node.type !== "dir") return err(`bash: cd: ${target}: Not a directory`);
  if (node.restricted) return err(`bash: cd: ${target}: Permission denied`);
  return { kind: "cd", cwd: abs };
};

const cat: CommandHandler = (args, ctx) => {
  const { operands } = splitFlags(args);
  // Sin archivos, cat espera la entrada estándar hasta Ctrl+C.
  if (!operands.length) return { kind: "stream", steps: [{ delay: 3_600_000 }] };
  const result: OutputLine[] = [];
  for (const target of operands) {
    const node = lookup(resolvePath(target, ctx.cwd));
    if (!node) result.push(line(`cat: ${target}: No such file or directory`, "error"));
    else if (node.type === "dir") result.push(line(`cat: ${target}: ${node.restricted ? "Permission denied" : "Is a directory"}`, "error"));
    else if (node.binary) result.push(...lines(target.endsWith(".pdf") ? "%PDF-1.7\n%����\n1 0 obj" : "\u007fELF\u0002\u0001\u0001\u0003>\u0001\u0010@8\r@\u001d\u001c\u0006\u0004@@@\u0018\u0003\u0018\u0003\b\u0003\u0004\u0018\u0003"));
    else result.push(...lines(node.content()));
  }
  return { kind: "output", lines: result };
};

/** Las variables ($$, $PPID, $HOME…) y ~ ya llegan expandidas desde el parser. */
const echo: CommandHandler = (args) => {
  const newline = args[0] !== "-n";
  return out(line((newline ? args : args.slice(1)).join(" ")));
};

export const fileCommands: Record<string, CommandHandler> = {
  ls,
  cd,
  pwd: (_, ctx) => out(line(ctx.cwd)),
  cat,
  echo,
};
