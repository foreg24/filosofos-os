/**
 * Registro explícito de comandos. Solo lo que está aquí existe:
 * nada se evalúa, nada se ejecuta fuera de esta tabla.
 */
import type { CommandResult, OutputLine } from "@/types/terminal";
import { type Env, type ParsedLine, parse } from "./commandParser";
import { HOME, debianSystem as S } from "./debianSystem";
import { fileCommands } from "./fileCommands";
import { LAB_SECTIONS, WINDOWS_EQUIVALENTS, lab } from "./labGuide";
import { isScriptOpen, philosopherCommands, python3, scriptHelp } from "./philosopherCommands";
import { FILTERS, filterCommandLine } from "./pipeline";
import { processCommands, runZombie } from "./processCommands";
import { machine } from "./processes/machine";
import { reserveTransients } from "./processes/processView";
import { MESA_PID, PHILOSOPHER_PIDS, tableActive } from "./processes/tableProcesses";
import { systemCommands } from "./systemCommands";
import { theme } from "./themeCommand";
import { type CommandContext, type CommandHandler, type SessionContext, line, out } from "./terminalTypes";
import { lookup, resolvePath } from "./virtualFs";

const HELP_GROUPS: [string, string[]][] = [
  ["GNU/Linux commands", ["cat /etc/os-release", "lsb_release -a", "uname -r", "uname -a", "whoami", "id", "uname -m", "hostname", "hostnamectl", "neofetch"]],
  ["Hardware", ["lscpu", "free -h", "lsblk", "lspci", "lsusb"]],
  ["System", ["top", "htop", "dmesg", "cat /proc/interrupts", "strace ls"]],
  [
    "Processes (lab)",
    ["lab", "ps aux", "ps -ef", "pstree -p", "sleep 300 &", "jobs", "kill -STOP <PID>", "kill -CONT <PID>", "kill -9 <PID>", "bash · echo $$ · echo $PPID", "cat /proc/<PID>/status | head -20", "./laboratorio/zombie &"],
  ],
  ["Filesystem", ["ls", "pwd", "cd", "clear", "history"]],
  ["Terminal", ["theme", "theme <color>   (o clic en la paleta de neofetch)", "theme reset"]],
  [
    "Dining Philosophers",
    [
      "philosophers",
      "forks",
      "simulation",
      "simulation mode <normal|deadlock|ordered|limited|asymmetric|monitor>",
      "simulation start · pause · resume · stop",
      "deadlock",
      "watch",
      "log [n]",
      "reset",
      "ps -o pid,stat,wchan:22,comm -p $FILOSOFOS",
      "pstree -p $MESA",
    ],
  ],
];

const help: CommandHandler = (_, ctx) =>
  isScriptOpen(ctx.tty)
    ? out(...scriptHelp())
    : out(
    ...HELP_GROUPS.flatMap(([title, cmds], i) => [...(i ? [line("")] : []), line(`${title}:`, "strong"), line(""), ...cmds.map((c) => line(`  ${c}`))]),
    line(""),
    line("Pipes: | grep · head · tail · sort · uniq · wc · awk '{print $N}'   Background: &", "muted"),
    line("Keys: Tab completes · ↑ ↓ history · Ctrl+L clears · Ctrl+C interrupts · Ctrl+Z stops", "muted"),
  );

const history: CommandHandler = (_, ctx) => out(...ctx.history.map((cmd, i) => line(`${String(i + 1).padStart(5)}  ${cmd}`)));

/**
 * head, tail, grep, wc, sort… fuera de una tubería leen el archivo que se les pasa al final
 * (`head -n 5 validacion/filosofos.py`); sin archivo esperan la entrada estándar hasta Ctrl+C.
 */
function fileFilter(name: string): CommandHandler {
  const filter = FILTERS[name];
  const needsArgument = name === "grep" || name === "awk";
  return (args, ctx) => {
    const last = args[args.length - 1];
    const operands = args.filter((a) => !a.startsWith("-"));
    const fileGiven = last !== undefined && !last.startsWith("-") && (!needsArgument || operands.length >= 2) && !/^\d+$/.test(last);
    if (!fileGiven) {
      if (needsArgument && !operands.length) {
        const r = filter([], args);
        return "error" in r ? out(...r.error.split("\n").map((t) => line(t, "error"))) : out();
      }
      return { kind: "stream", steps: [{ delay: 3_600_000 }] };
    }
    const node = lookup(resolvePath(last, ctx.cwd));
    if (!node) return out(line(`${name}: ${last}: No such file or directory`, "error"));
    if (node.type === "dir") return out(line(`${name}: ${last}: Is a directory`, "error"));
    const text = node.content();
    const r = filter((text.endsWith("\n") ? text.slice(0, -1) : text).split("\n"), args.slice(0, -1));
    if ("error" in r) return out(...r.error.split("\n").map((t) => line(t, "error")));
    // wc nombra el archivo después de los conteos: "726 validacion/filosofos.py".
    return { kind: "output", lines: name === "wc" ? r.lines.map((l) => line(`${l.spans.map((s) => s.text).join("")} ${last}`)) : r.lines };
  };
}

const FILE_FILTERS = Object.fromEntries(["grep", "head", "tail", "sort", "uniq", "wc", "awk", "less", "more"].map((n) => [n, fileFilter(n)]));

const REGISTRY = new Map<string, CommandHandler>(
  Object.entries({
    ...FILE_FILTERS,
    ...systemCommands,
    ...fileCommands,
    ...philosopherCommands,
    ...processCommands,
    help,
    history,
    lab,
    theme,
    clear: () => ({ kind: "clear" }) as CommandResult,
  }),
);

/** Integrados de bash: no crean un proceso nuevo (no consumen PID). */
const BUILTINS = new Set(["cd", "echo", "pwd", "kill", "jobs", "fg", "bg", "exit", "logout", "history", "help", "bash", "sleep"]);

export const COMMAND_NAMES = [...REGISTRY.keys()].sort();
export { LAB_SECTIONS };

/** Último código de salida por shell ($?). */
const lastStatus = new Map<number, number>();

function environment(ctx: SessionContext, shell: number): Env {
  const m = machine();
  return {
    $: String(shell),
    PPID: String(m.get(shell)?.ppid ?? 1),
    "!": String(m.lastBackgroundOf(shell) ?? ""),
    "?": String(lastStatus.get(shell) ?? 0),
    "#": "0",
    "0": "bash",
    USER: S.username,
    LOGNAME: S.username,
    HOME,
    HOSTNAME: S.hostname,
    SHELL: S.shell,
    PWD: ctx.cwd,
    LANG: "en_US.UTF-8",
    TERM: "xterm-256color",
    UID: "1000",
    // Las exporta filosofos.py mientras sus procesos están vivos.
    ...(tableActive() ? { FILOSOFOS: PHILOSOPHER_PIDS.join(","), MESA: String(MESA_PID) } : {}),
  };
}

/** Programas ejecutables por ruta (./zombie, ~/laboratorio/zombie…). */
function runPath(name: string, ctx: CommandContext, raw: string): CommandResult {
  const node = lookup(resolvePath(name, ctx.cwd));
  if (!node) return out(line(`bash: ${name}: No such file or directory`, "error"));
  if (node.type === "dir") return out(line(`bash: ${name}: Is a directory`, "error"));
  if (!node.exec) return out(line(`bash: ${name}: Permission denied`, "error"));
  // filosofos.py tiene la línea #!/usr/bin/env python3: se ejecuta como python3 filosofos.py.
  if (name.endsWith("filosofos.py")) return python3([name], ctx, { raw, name: "python3", args: [name] });
  return runZombie(ctx, raw);
}

function notFound(name: string): CommandResult {
  const equivalent = WINDOWS_EQUIVALENTS[name.toLowerCase()];
  return out(
    line(`bash: ${name}: command not found`, "error"),
    ...(equivalent ? [line(`  Comando de Windows. En Debian: ${equivalent}   (ver: lab comparar)`, "muted")] : []),
  );
}

const plain = (l: OutputLine) => l.spans.map((s) => s.text).join("");

function runLine(parsed: ParsedLine, ctx: CommandContext): CommandResult {
  const [first, ...filters] = parsed.pipeline;
  const handler = REGISTRY.get(first.name);
  let result: CommandResult;
  if (first.name.includes("/")) result = runPath(first.name, ctx, first.raw);
  else if (!handler) return notFound(first.name);
  else result = handler(first.args, ctx, first);
  if (!filters.length) return result;

  // Un programa que no produce texto de una vez (sleep, watch…) se ejecuta igual; la tubería queda vacía.
  if (result.kind !== "output") return result;
  let text = result.lines.map(plain);
  let lines: OutputLine[] = result.lines;
  for (const f of filters) {
    const filter = FILTERS[f.name];
    if (!filter) {
      // Un comando que no lee de la entrada estándar la ignora (como `ps | ls`): su salida es la final.
      const other = REGISTRY.get(f.name);
      return other ? other(f.args, ctx, f) : notFound(f.name);
    }
    const r = filter(text, f.args);
    if ("error" in r) return out(...r.error.split("\n").map((t) => line(t, "error")));
    lines = r.lines;
    text = lines.map(plain);
  }
  return { kind: "output", lines };
}

export function execute(raw: string, session: SessionContext): CommandResult {
  const m = machine();
  const shell = m.shell(session.tty);
  const parsed = parse(raw, environment(session, shell));
  const notes = () => m.takeNotes(shell).map((t) => line(t));

  if (!parsed.ok) {
    if (parsed.reason === "empty") return out(...notes());
    lastStatus.set(shell, 2);
    if (parsed.reason === "quote") return out(line("bash: unexpected EOF while looking for matching quote", "error"));
    if (parsed.reason === "pipe") return out(line(`bash: syntax error near unexpected token \`${parsed.token ?? "|"}'`, "error"));
    return out(line(`bash: syntax error near unexpected token \`${parsed.token}'`, "error"));
  }

  const { pipeline, background } = parsed.line;
  if (pipeline[0].name !== "exit" && pipeline[0].name !== "logout") m.clearExitWarning(shell);
  const transients = reserveTransients(
    pipeline
      .filter((c) => !BUILTINS.has(c.name))
      .map((c) => ({ comm: (c.name.split("/").pop() ?? c.name).slice(0, 15), cmd: c.name === "ls" ? `ls --color=auto ${c.args.join(" ")}`.trim() : filterCommandLine(c.name, c.args) })),
  );
  const ctx: CommandContext = { ...session, shell, piped: pipeline.length > 1, transients };

  let result = runLine(parsed.line, ctx);

  // Programas (sleep, ./zombie): en segundo plano con &, o en primer plano ocupando la terminal.
  if (result.kind === "process") {
    const job = m.addJob(shell, result.pid, pipeline[0].raw, background);
    if (!background) {
      m.setForeground(session.tty, result.pid);
      return { kind: "foreground", pid: result.pid, lines: result.lines };
    }
    result = out(line(`[${job.id}] ${result.pid}`), ...result.lines);
  } else if (background && result.kind === "output") {
    const { id, pid } = m.addFinishedJob(shell, parsed.line.raw.replace(/\s*&$/, ""));
    result = out(line(`[${id}] ${pid}`), ...result.lines);
  }

  if (result.kind === "output") {
    const first = result.lines[0]?.spans[0];
    lastStatus.set(shell, first?.tone === "error" ? (first.text.includes("command not found") ? 127 : 1) : 0);
    return { kind: "output", lines: [...result.lines, ...notes()] };
  }
  return result;
}
