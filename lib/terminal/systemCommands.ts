/** Identificación del sistema, hardware y procesos. */
import { splitFlags } from "./commandParser";
import {
  dmesg,
  free,
  hostnamectl,
  idOutput,
  lsblk,
  lsbRelease,
  lscpu,
  lspci,
  lsusb,
  straceLs,
  unameAll,
} from "./debianOutputs";
import { debianSystem as S, prettyName } from "./debianSystem";
import { lsGrid } from "./fileCommands";
import { neofetch } from "./neofetch";
import { htop, top } from "./processOutputs";
import { viewProcesses } from "./processes/processView";
import { type CommandContext, type CommandHandler, line, lines, out, outText } from "./terminalTypes";
import { listDir, lookup } from "./virtualFs";

/** top y htop leen la misma tabla que ps (se cuentan a sí mismos, como los reales). `top -p a,b,…` filtra. */
const snapshot = (ctx: CommandContext, args: string[] = []) => {
  const procs = viewProcesses({ tty: ctx.tty, transients: ctx.transients });
  const at = args.indexOf("-p");
  const pids = at >= 0 ? (args[at + 1] ?? "").split(",").map(Number) : null;
  return { procs: pids ? procs.filter((p) => pids.includes(p.pid)) : procs, self: ctx.transients[0]?.pid ?? 0 };
};

const invalidOption = (cmd: string, opt: string) =>
  out(line(`${cmd}: invalid option -- '${opt}'`, "error"), line(`Try '${cmd} --help' for more information.`));

const uname: CommandHandler = (args) => {
  const { flags, long, operands } = splitFlags(args);
  if (operands.length) return out(line(`uname: extra operand '${operands[0]}'`, "error"), line("Try 'uname --help' for more information."));
  if (long.length) return out(line(`uname: unrecognized option '--${long[0]}'`, "error"), line("Try 'uname --help' for more information."));
  const bad = [...flags].find((f) => !"asnrvmpio".includes(f));
  if (bad) return invalidOption("uname", bad);
  if (flags.has("a")) return outText(unameAll());
  const values: Record<string, string> = { s: "Linux", n: S.hostname, r: S.kernel, v: S.kernelBuild, m: S.machine, p: "unknown", i: "unknown", o: "GNU/Linux" };
  const selected = "snrvmpio".split("").filter((k) => flags.has(k));
  return outText((selected.length ? selected : ["s"]).map((k) => values[k]).join(" "));
};

const lsbReleaseCmd: CommandHandler = (args) => {
  const { flags } = splitFlags(args);
  if (flags.has("a") || !flags.size) return outText(flags.has("a") ? lsbRelease() : "No LSB modules are available.");
  const map: Record<string, string> = {
    i: "Distributor ID:\tDebian",
    d: `Description:\t${prettyName}`,
    r: `Release:\t${S.version}`,
    c: `Codename:\t${S.codename}`,
  };
  const short = flags.has("s");
  const picked = "idrc".split("").filter((f) => flags.has(f)).map((f) => (short ? map[f].split("\t")[1] : map[f]));
  return out(line("No LSB modules are available."), ...lines(short ? picked.join(" ") : picked.join("\n")));
};

const hostname: CommandHandler = (args) => {
  const { flags, operands } = splitFlags(args);
  if (operands.length) return out(line("hostname: you must be root to change the host name", "error"));
  if (flags.has("I")) return outText(`${S.ip} `);
  return outText(S.hostname);
};

const freeCmd: CommandHandler = (args) => {
  const { flags, long } = splitFlags(args);
  const unit = flags.has("h") || long.includes("human") ? "h" : flags.has("m") ? "m" : "k";
  return outText(free(unit));
};

const strace: CommandHandler = (args, ctx) => {
  if (!args.length) return out(line("strace: must have PROG [ARGS] or -p PID", "error"), line("Try 'strace -h' for more information."));
  if (args[0] !== "ls") return out(line(`strace: ptrace(PTRACE_TRACEME, ...): Operation not permitted`, "error"), line("+++ exited with 1 +++"));
  const dir = lookup(ctx.cwd);
  const grid = dir ? lsGrid(listDir(dir), dir) : [];
  const listing = grid.map((l) => l.spans.map((s) => s.text).join("")).join("\n");
  return out(...lines(straceLs(listing).join("\n"), "muted"), ...grid);
};

const apt: CommandHandler = (args) => {
  const op = args[0];
  if (!op) return out(line("Usage: apt [options] command"), line("Most used commands: list, search, show, install, remove, update, upgrade"));
  if (["install", "remove", "purge", "update", "upgrade", "autoremove", "full-upgrade"].includes(op)) {
    return out(
      line("E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)", "error"),
      line("E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?", "error"),
    );
  }
  return out(line(`E: Invalid operation ${op}`, "error"));
};

export const systemCommands: Record<string, CommandHandler> = {
  whoami: () => outText(S.username),
  id: () => outText(idOutput()),
  hostname,
  hostnamectl: () => outText(hostnamectl()),
  neofetch: (_, ctx) => out(...neofetch(Math.floor((Date.now() - ctx.sessionStart) / 60000))),
  uname,
  lsb_release: lsbReleaseCmd,
  lscpu: () => outText(lscpu()),
  free: freeCmd,
  lsblk: () => outText(lsblk()),
  lspci: () => outText(lspci()),
  lsusb: () => outText(lsusb()),
  top: (args, ctx) => out(...top({ now: new Date(), sessionStart: ctx.sessionStart, ...snapshot(ctx, args) })),
  htop: (_, ctx) => out(...htop({ now: new Date(), sessionStart: ctx.sessionStart, ...snapshot(ctx) })),
  dmesg: () => out(...lines(dmesg())),
  strace,
  sudo: (args) =>
    args.length
      ? { kind: "password", message: `[sudo] password for ${S.username}: ` }
      : out(line("usage: sudo -h | -K | -k | -V"), line("usage: sudo [-u user] command [arg ...]")),
  apt,
  "apt-get": apt,
};
