/**
 * Configuración única de la máquina Debian.
 * Todas las salidas se calculan a partir de aquí: cambiar un valor aquí lo cambia en todos los comandos.
 */
export const debianSystem = {
  username: "exposiciónSO",
  hostname: "jcJF",
  distribution: "Debian GNU/Linux",
  version: "13",
  codename: "trixie",
  kernel: "6.12.101+deb13-amd64",
  kernelBuild: "#1 SMP PREEMPT_DYNAMIC Debian 6.12.101-1",
  architecture: "x86-64",
  machine: "x86_64",
  cpuCores: 2,
  cpuModel: "Intel(R) Core(TM) i7-6700 CPU @ 3.40GHz",
  cpuMHz: 3400,
  memory: "3.8 GiB",
  swap: "1.1 GiB",
  disk: "20 GB",
  diskSize: "20G",
  virtualization: "oracle",
  hypervisor: "Oracle",
  hardwareVendor: "innotek GmbH",
  hardwareModel: "VirtualBox",
  ip: "10.0.2.15",
  /** Lo que muestra neofetch (coherente con el escritorio que aparece en la secuencia del portátil). */
  hostModel: "VirtualBox 1.2",
  cpuShort: "Intel i7-6700",
  packages: "1587 (dpkg)",
  bashVersion: "5.2.37",
  resolution: "1536x1024",
  desktop: "GNOME 48",
  windowManager: "Mutter",
  theme: "Adwaita",
  terminal: "gnome-terminal",
  shell: "/bin/bash",
  tty: "pts/0",
  /** Memoria en MiB: free, free -h y top derivan de estos valores. */
  mem: { totalMiB: 3921.9, usedMiB: 1197.1, freeMiB: 1150.0, sharedMiB: 120.0, buffCacheMiB: 1574.8, availableMiB: 2460.2 },
  swapMiB: { totalMiB: 1126.0, usedMiB: 0 },
  /** Disco virtual: sda1 + sda2 + sda5 = 20 G. */
  partitions: { root: "18.9G", extended: "1K", swap: "1.1G" },
  uptimeAtLoad: { hours: 1, minutes: 24 },
} as const;

export type DebianSystem = typeof debianSystem;

export const HOME = `/home/${debianSystem.username}`;
export const prettyName = `${debianSystem.distribution} ${debianSystem.version} (${debianSystem.codename})`;

/** Hash FNV-1a: identificadores estables (no cambian entre ejecuciones ni sesiones). */
function stableHex(seed: string, length = 32): string {
  let out = "";
  let h = 0x811c9dc5;
  let i = 0;
  while (out.length < length) {
    for (const ch of `${seed}:${i++}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return out.slice(0, length);
}

export const machineId = stableHex(`machine-${debianSystem.hostname}`);
export const bootId = stableHex(`boot-${debianSystem.hostname}-${debianSystem.kernel}`);

/** "~" para el home; ruta absoluta en cualquier otro lugar. */
export function displayPath(cwd: string): string {
  if (cwd === HOME) return "~";
  if (cwd.startsWith(`${HOME}/`)) return `~${cwd.slice(HOME.length)}`;
  return cwd;
}
