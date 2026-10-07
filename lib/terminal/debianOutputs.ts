/**
 * Salidas de la máquina Debian. Todas derivan de `debianSystem`:
 * ningún valor (usuario, host, kernel, memoria…) se escribe a mano en dos sitios.
 */
import { bootId, debianSystem as S, machineId, prettyName } from "./debianSystem";

const pad = (label: string, width: number) => label.padEnd(width);

export const osRelease = () =>
  [
    `PRETTY_NAME="${prettyName}"`,
    `NAME="${S.distribution}"`,
    `VERSION_ID="${S.version}"`,
    `VERSION="${S.version} (${S.codename})"`,
    `VERSION_CODENAME=${S.codename}`,
    "ID=debian",
    'HOME_URL="https://www.debian.org/"',
    'SUPPORT_URL="https://www.debian.org/support"',
    'BUG_REPORT_URL="https://bugs.debian.org/"',
  ].join("\n");

export const lsbRelease = () =>
  [
    "No LSB modules are available.",
    "Distributor ID:\tDebian",
    `Description:\t${prettyName}`,
    `Release:\t${S.version}`,
    `Codename:\t${S.codename}`,
  ].join("\n");

export const unameAll = () => `Linux ${S.hostname} ${S.kernel} ${S.kernelBuild} ${S.machine} GNU/Linux`;

export const idOutput = () => {
  const u = S.username;
  return `uid=1000(${u}) gid=1000(${u}) groups=1000(${u}),27(sudo),44(video),46(plugdev),100(users)`;
};

export const hostnamectl = () =>
  (
    [
      ["Static hostname", S.hostname],
      ["Icon name", "computer-vm"],
      ["Chassis", "vm"],
      ["Machine ID", machineId],
      ["Boot ID", bootId],
      ["Virtualization", S.virtualization],
      ["Operating System", prettyName],
      ["Kernel", `Linux ${S.kernel}`],
      ["Architecture", S.architecture],
      ["Hardware Vendor", S.hardwareVendor],
      ["Hardware Model", S.hardwareModel],
    ] as const
  )
    .map(([k, v]) => `${k.padStart(16)}: ${v}`)
    .join("\n");

export const lscpu = () =>
  (
    [
      ["Architecture", S.machine],
      ["CPU op-mode(s)", "32-bit, 64-bit"],
      ["Address sizes", "39 bits physical, 48 bits virtual"],
      ["Byte Order", "Little Endian"],
      ["CPU(s)", String(S.cpuCores)],
      ["On-line CPU(s) list", Array.from({ length: S.cpuCores }, (_, i) => i).join(",")],
      ["Vendor ID", "GenuineIntel"],
      ["Model name", S.cpuModel],
      ["CPU family", "6"],
      ["Model", "94"],
      ["Thread(s) per core", "1"],
      ["Core(s) per socket", String(S.cpuCores)],
      ["Socket(s)", "1"],
      ["Stepping", "3"],
      ["CPU MHz", S.cpuMHz.toFixed(3)],
      ["BogoMIPS", (S.cpuMHz * 2.004).toFixed(2)],
      ["Virtualization", "VT-x"],
      ["Hypervisor vendor", S.hypervisor],
      ["Virtualization type", "full"],
      ["L1d cache", `${32 * S.cpuCores} KiB (${S.cpuCores} instances)`],
      ["L2 cache", `${256 * S.cpuCores} KiB (${S.cpuCores} instances)`],
      ["L3 cache", "8 MiB (1 instance)"],
    ] as const
  )
    .map(([k, v]) => `${pad(`${k}:`, 38)}${v}`)
    .join("\n");

/** MiB → formato de `free -h` (Gi / Mi / B). */
const human = (mib: number) => (mib >= 1024 ? `${(mib / 1024).toFixed(1)}Gi` : mib >= 1 ? `${Math.round(mib)}Mi` : "0B");

export function free(unit: "h" | "m" | "k") {
  const f = (mib: number) => (unit === "h" ? human(mib) : unit === "m" ? String(Math.round(mib)) : String(Math.round(mib * 1024)));
  const m = S.mem;
  const sw = S.swapMiB;
  const row = (label: string, values: number[]) => pad(label, 8) + values.map((v) => f(v).padStart(12)).join("");
  return [
    pad("", 8) + ["total", "used", "free", "shared", "buff/cache", "available"].map((h) => h.padStart(12)).join(""),
    row("Mem:", [m.totalMiB, m.usedMiB, m.freeMiB, m.sharedMiB, m.buffCacheMiB, m.availableMiB]),
    row("Swap:", [sw.totalMiB, sw.usedMiB, sw.totalMiB - sw.usedMiB]),
  ].join("\n");
}

export const lsblk = () => {
  const row = (name: string, maj: string, min: string, rm: string, size: string, ro: string, type: string, mount = "") =>
    `${name.padEnd(7)}${maj.padStart(3)}:${min.padEnd(3)} ${rm.padStart(2)} ${size.padStart(6)} ${ro.padStart(2)} ${type.padEnd(4)} ${mount}`.trimEnd();
  return [
    "NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS",
    row("sda", "8", "0", "0", S.diskSize, "0", "disk"),
    row("├─sda1", "8", "1", "0", S.partitions.root, "0", "part", "/"),
    row("├─sda2", "8", "2", "0", S.partitions.extended, "0", "part"),
    row("└─sda5", "8", "5", "0", S.partitions.swap, "0", "part", "[SWAP]"),
    row("sr0", "11", "0", "1", "1024M", "0", "rom"),
  ].join("\n");
};

export const lspci = () =>
  [
    "00:00.0 Host bridge: Intel Corporation 440FX - 82441FX PMC [Natoma] (rev 02)",
    "00:01.0 ISA bridge: Intel Corporation 82371SB PIIX3 ISA [Natoma/Triton II]",
    "00:01.1 IDE interface: Intel Corporation 82371AB/EB/MB PIIX4 IDE (rev 01)",
    "00:02.0 VGA compatible controller: VMware SVGA II Adapter",
    "00:03.0 Ethernet controller: Intel Corporation 82540EM Gigabit Ethernet Controller (rev 02)",
    "00:04.0 System peripheral: InnoTek Systemberatung GmbH VirtualBox Guest Service",
    "00:05.0 Multimedia audio controller: Intel Corporation 82801AA AC'97 Audio Controller (rev 01)",
    "00:06.0 USB controller: Apple Inc. KeyLargo/Intrepid USB",
    "00:07.0 Bridge: Intel Corporation 82371AB/EB/MB PIIX4 ACPI (rev 08)",
    "00:0b.0 USB controller: Intel Corporation 82801FB/FBM/FR/FW/FRW (ICH6 Family) USB2 EHCI Controller",
  ].join("\n");

export const lsusb = () =>
  [
    "Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub",
    "Bus 001 Device 002: ID 80ee:0021 VirtualBox USB Tablet",
    "Bus 002 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub",
  ].join("\n");

export const interrupts = () => {
  const cpus = Array.from({ length: S.cpuCores }, (_, i) => `CPU${i}`.padStart(i === 0 ? 15 : 11)).join("");
  const rows: [string, number, number, string, string][] = [
    ["0", 33, 0, "2-edge", "timer"],
    ["1", 0, 1033, "1-edge", "i8042"],
    ["8", 0, 214, "8-edge", "rtc0"],
    ["9", 0, 0, "9-fasteoi", "acpi"],
    ["12", 0, 512, "12-edge", "i8042"],
    ["14", 0, 3417, "14-edge", "ata_piix"],
    ["15", 0, 842, "15-edge", "ata_piix"],
    ["19", 903, 2211, "19-fasteoi", "enp0s3"],
  ];
  return [
    cpus,
    ...rows.map(([irq, a, b, kind, dev]) => `${`${irq}:`.padStart(4)}${String(a).padStart(11)}${String(b).padStart(11)}   IO-APIC ${kind.padStart(11)}      ${dev}`),
    `${"NMI:".padStart(4)}${"0".padStart(11)}${"0".padStart(11)}   Non-maskable interrupts`,
    `${"LOC:".padStart(4)}${"41522".padStart(11)}${"39870".padStart(11)}   Local timer interrupts`,
  ].join("\n");
};

export const dmesg = () =>
  [
    `[    0.000000] Linux version ${S.kernel} (debian-kernel@lists.debian.org)`,
    "[    0.000000] Command line: BOOT_IMAGE=/boot/vmlinuz root=/dev/sda1 ro quiet",
    `[    0.000000] DMI: ${S.hardwareVendor} ${S.hardwareModel}/${S.hardwareModel}, BIOS ${S.hardwareModel}`,
    "[    0.012341] ACPI: Core revision 20250214",
    `[    0.034211] smpboot: CPU0: ${S.cpuModel} (family: 0x6, model: 0x5e, stepping: 0x3)`,
    `[    0.041870] smp: Brought up 1 node, ${S.cpuCores} CPUs`,
    "[    0.102421] vboxguest: host-version: 7.1.6 0x8000000f",
    "[    0.481923] ata_piix 0000:00:01.1: version 2.13",
    "[    0.912431] EXT4-fs (sda1): mounted filesystem with ordered data mode.",
    "[    1.203112] e1000 0000:00:03.0 enp0s3: renamed from eth0",
    `[    1.334051] Adding ${Math.round(S.swapMiB.totalMiB * 1024)}k swap on /dev/sda5.`,
  ].join("\n");

/** Formato por columnas de `ls` en un terminal de 80 columnas: filas de celdas ya rellenadas. */
export function lsColumns(names: string[], width = 80): string[][] {
  if (!names.length) return [];
  for (let cols = names.length; cols >= 1; cols--) {
    const rows = Math.ceil(names.length / cols);
    const widths = Array.from({ length: cols }, (_, c) => Math.max(0, ...names.slice(c * rows, c * rows + rows).map((n) => n.length)));
    const total = widths.reduce((a, w) => a + w + 2, -2);
    if (total <= width || cols === 1) {
      return Array.from({ length: rows }, (_, r) => {
        const cells = widths.map((_, c) => names[c * rows + r]).filter((n): n is string => n !== undefined);
        return cells.map((n, c) => (c === cells.length - 1 ? n : n.padEnd(widths[c] + 2)));
      });
    }
  }
  return names.map((n) => [n]);
}

export function straceLs(listing: string) {
  const payload = `${listing}\n`;
  const bytes = new TextEncoder().encode(payload).length;
  const escaped = payload.replace(/\n/g, "\\n");
  return [
    'execve("/usr/bin/ls", ["ls"], 0x7ffd3c1e2a50 /* 42 vars */) = 0',
    "brk(NULL)                               = 0x55f1c2a4e000",
    'access("/etc/ld.so.preload", R_OK)      = -1 ENOENT (No such file or directory)',
    'openat(AT_FDCWD, "/etc/ld.so.cache", O_RDONLY|O_CLOEXEC) = 3',
    "close(3)                                = 0",
    'openat(AT_FDCWD, "/lib/x86_64-linux-gnu/libselinux.so.1", O_RDONLY|O_CLOEXEC) = 3',
    'read(3, "\\177ELF\\2\\1\\1\\0\\0\\0\\0\\0\\0\\0\\0\\0\\3\\0>\\0\\1\\0\\0\\0"..., 832) = 832',
    "close(3)                                = 0",
    "ioctl(1, TCGETS, {c_iflag=ICRNL|IXON, c_oflag=NL0|CR0|TAB0|BS0|VT0|FF0|OPOST|ONLCR, ...}) = 0",
    'openat(AT_FDCWD, ".", O_RDONLY|O_NONBLOCK|O_CLOEXEC|O_DIRECTORY) = 3',
    "fstat(3, {st_mode=S_IFDIR|0755, st_size=4096, ...}) = 0",
    "getdents64(3, 0x55f1c2a55f10 /* 12 entries */, 32768) = 392",
    "getdents64(3, 0x55f1c2a55f10 /* 0 entries */, 32768) = 0",
    "close(3)                                = 0",
    `write(1, "${escaped}", ${bytes}) = ${bytes}`,
    "close(1)                                = 0",
    "close(2)                                = 0",
    "exit_group(0)                           = ?",
    "+++ exited with 0 +++",
  ];
}
