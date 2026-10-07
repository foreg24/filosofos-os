/**
 * Procesos con los que arranca la máquina Debian: GNOME en VirtualBox, dos pestañas de
 * gnome-terminal (pts/0 y pts/1) e hilos del kernel. 187 procesos: con el propio ps o top, 188
 * (lo que ya muestra `top`). Coherente con debianSystem (usuario, memoria, VirtualBox).
 */
import { debianSystem as S } from "../debianSystem";

export interface BaseProc {
  pid: number;
  ppid: number;
  user: string;
  /** Estado + modificadores de ps (Ss, Ssl, S<sl, I<…). */
  stat: string;
  threads: number;
  /** KiB */
  vsz: number;
  rss: number;
  /** %CPU instantáneo (top). */
  cpu: number;
  /** Minutos tras el arranque. */
  start: number;
  /** Segundos de CPU acumulados al cargar la página. */
  time: number;
  comm: string;
  cmd: string;
  tty?: string;
  /** Sostiene el escritorio: kill responde «Operation not permitted». */
  protected?: boolean;
  kernel?: boolean;
}

const U = S.username;
const p = (
  pid: number,
  ppid: number,
  user: string,
  stat: string,
  threads: number,
  vsz: number,
  rss: number,
  cpu: number,
  start: number,
  time: number,
  comm: string,
  cmd: string,
  extra: Partial<BaseProc> = {},
): BaseProc => ({ pid, ppid, user, stat, threads, vsz, rss, cpu, start, time, comm, cmd, ...extra });

const GSD = ["a11y-settings", "color", "datetime", "housekeeping", "keyboard", "media-keys", "power", "print-notifications", "rfkill", "screensaver-proxy", "sharing", "smartcard", "sound", "wacom"];

const USER_PROCESSES: BaseProc[] = [
  p(1, 0, "root", "Ss", 1, 24628, 14336, 0, 0, 1.42, "systemd", "/sbin/init", { protected: true }),
  p(301, 1, "root", "Ss", 1, 58792, 21504, 0, 0, 0.61, "systemd-journal", "/usr/lib/systemd/systemd-journald"),
  p(332, 1, "root", "Ss", 1, 29500, 8192, 0, 0, 0.47, "systemd-udevd", "/usr/lib/systemd/systemd-udevd"),
  p(498, 1, "systemd-timesync", "Ssl", 2, 90808, 6912, 0, 0, 0.05, "systemd-timesyn", "/usr/lib/systemd/systemd-timesyncd"),
  p(560, 1, "avahi", "Ss", 1, 8672, 4096, 0, 0, 0.04, "avahi-daemon", `avahi-daemon: running [${S.hostname}.local]`),
  p(561, 1, "root", "Ss", 1, 6696, 2816, 0, 0, 0.01, "cron", "/usr/sbin/cron -f"),
  p(562, 1, "messagebus", "Ss", 1, 9832, 5504, 0, 0, 0.73, "dbus-daemon", "/usr/bin/dbus-daemon --system --address=systemd: --nofork --nopidfile --systemd-activation --syslog-only"),
  p(564, 1, "polkitd", "Ssl", 4, 384228, 10752, 0, 0, 0.21, "polkitd", "/usr/lib/polkit-1/polkitd --no-debug --log-level=notice"),
  p(567, 1, "root", "Ssl", 4, 316072, 7552, 0, 0, 0.08, "power-profiles-", "/usr/libexec/power-profiles-daemon"),
  p(568, 1, "rtkit", "SNsl", 3, 22768, 3200, 0, 0, 0.02, "rtkit-daemon", "/usr/libexec/rtkit-daemon"),
  p(570, 1, "root", "Ss", 1, 17832, 8448, 0, 0, 0.12, "systemd-logind", "/usr/lib/systemd/systemd-logind"),
  p(571, 1, "root", "Ssl", 5, 470860, 13056, 0, 0, 0.19, "udisksd", "/usr/libexec/udisks2/udisksd"),
  p(575, 560, "avahi", "S", 1, 8492, 1536, 0, 0, 0, "avahi-daemon", "avahi-daemon: chroot helper"),
  p(587, 1, "root", "Ssl", 4, 334048, 20096, 0, 0, 0.62, "NetworkManager", "/usr/sbin/NetworkManager --no-daemon"),
  p(590, 1, "root", "Ss", 1, 17540, 10368, 0, 0, 0.03, "wpa_supplicant", "/usr/sbin/wpa_supplicant -u -s -O DIR=/run/wpa_supplicant GROUP=netdev"),
  p(612, 1, "root", "Sl", 9, 303456, 3584, 0.4, 0, 3.51, "VBoxService", "/usr/sbin/VBoxService --pidfile /var/run/vboxadd-service.sh"),
  p(634, 1, "root", "Ssl", 4, 393016, 11776, 0, 0, 0.18, "ModemManager", "/usr/sbin/ModemManager"),
  p(660, 1, "root", "Ss", 1, 38936, 13568, 0, 0, 0.06, "cupsd", "/usr/sbin/cupsd -l"),
  p(668, 1, "root", "Ssl", 3, 243428, 13056, 0, 0, 0.05, "cups-browsed", "/usr/sbin/cups-browsed"),
  p(700, 1, "root", "Ssl", 4, 243124, 10496, 0, 0, 0.04, "gdm3", "/usr/sbin/gdm3"),
  p(712, 1, "root", "Ssl", 4, 239880, 9088, 0, 0, 0.09, "accounts-daemon", "/usr/libexec/accounts-daemon"),
  p(731, 1, "root", "Ssl", 4, 247372, 8704, 0, 1, 0.11, "upowerd", "/usr/libexec/upowerd"),
  p(905, 700, "root", "Sl", 4, 169356, 10496, 0, 1, 0.03, "gdm-session-wor", "gdm-session-worker [pam/gdm-password]"),
  p(1010, 1, U, "Ss", 1, 21480, 12160, 0, 1, 0.34, "systemd", "/usr/lib/systemd/systemd --user", { protected: true }),
  p(1011, 1010, U, "S", 1, 104456, 4608, 0, 1, 0, "(sd-pam)", "(sd-pam)"),
  p(1024, 1010, U, "Sl", 11, 11743148, 96512, 2.1, 1, 42.18, "node", `node /home/${U}/exposicion/server.js`, { protected: true }),
  p(1026, 1010, U, "S<sl", 3, 104428, 13824, 0.1, 1, 1.12, "pipewire", "/usr/bin/pipewire"),
  p(1027, 1010, U, "S<sl", 2, 29180, 5760, 0, 1, 0.03, "pipewire", "/usr/bin/pipewire -c filter-chain.conf"),
  p(1029, 1010, U, "S<sl", 5, 356724, 14976, 0, 1, 0.21, "wireplumber", "/usr/bin/wireplumber"),
  p(1030, 1010, U, "S<sl", 3, 31568, 6912, 0, 1, 0.05, "pipewire-pulse", "/usr/bin/pipewire-pulse"),
  p(1032, 1010, U, "Ss", 1, 10324, 5888, 0, 1, 0.94, "dbus-daemon", "/usr/bin/dbus-daemon --session --address=systemd: --nofork --nopidfile --systemd-activation --syslog-only"),
  p(1041, 1010, U, "SLl", 4, 386788, 8448, 0, 1, 0.02, "gnome-keyring-d", "/usr/bin/gnome-keyring-daemon --foreground --components=pkcs11,secrets --control-directory=/run/user/1000/keyring"),
  p(1047, 905, U, "Ssl+", 3, 162500, 6272, 0, 1, 0, "gdm-wayland-ses", "/usr/libexec/gdm-wayland-session /usr/bin/gnome-session", { tty: "tty2" }),
  p(1052, 1047, U, "Sl+", 4, 227236, 16768, 0, 1, 0.04, "gnome-session-b", "/usr/libexec/gnome-session-binary", { tty: "tty2" }),
  p(1110, 1010, U, "Ssl", 3, 243584, 7680, 0, 1, 0.01, "gvfsd", "/usr/libexec/gvfsd"),
  p(1117, 1010, U, "Sl", 6, 382628, 6528, 0, 1, 0, "gvfsd-fuse", "/usr/libexec/gvfsd-fuse /run/user/1000/gvfs -f"),
  p(1135, 1010, U, "Ssl", 2, 101412, 5120, 0, 1, 0, "gnome-session-c", "/usr/libexec/gnome-session-ctl --monitor"),
  p(1140, 1010, U, "Ssl", 5, 457004, 18432, 0, 1, 0.11, "gnome-session-b", "/usr/libexec/gnome-session-binary --systemd-service --session=gnome"),
  p(1236, 1, "colord", "Ssl", 4, 242708, 13952, 0, 1, 0.05, "colord", "/usr/libexec/colord"),
  p(1402, 1010, U, "Ssl", 12, 4210388, 212344, 0.9, 1, 72.07, "gnome-shell", "/usr/bin/gnome-shell", { protected: true }),
  p(1433, 1010, U, "Sl", 5, 309960, 7424, 0, 1, 0.02, "at-spi-bus-laun", "/usr/libexec/at-spi-bus-launcher"),
  p(1440, 1433, U, "S", 1, 9184, 4608, 0, 1, 0.07, "dbus-daemon", "/usr/bin/dbus-daemon --config-file=/usr/share/defaults/at-spi2/accessibility.conf --nofork --print-address 11 --address=unix:path=/run/user/1000/at-spi/bus"),
  p(1452, 1010, U, "Ssl", 3, 242664, 6656, 0, 1, 0, "xdg-permission-", "/usr/libexec/xdg-permission-store"),
  p(1466, 1010, U, "Ssl", 6, 691940, 27136, 0, 1, 0.06, "gnome-shell-cal", "/usr/libexec/gnome-shell-calendar-server"),
  p(1477, 1010, U, "Ssl", 5, 846312, 30976, 0, 1, 0.04, "evolution-sourc", "/usr/libexec/evolution-source-registry"),
  p(1489, 1010, U, "Sl", 5, 591956, 36864, 0, 1, 0.08, "goa-daemon", "/usr/libexec/goa-daemon"),
  ...GSD.map((name, i) =>
    p(1496 + i, 1010, U, "Ssl", i % 3 === 0 ? 3 : 4, 330000 + i * 7431, 21000 + i * 523, 0, 1, 0.02 + (i % 4) * 0.01, `gsd-${name}`.slice(0, 15), `/usr/libexec/gsd-${name}`),
  ),
  p(1515, 1010, U, "Ssl", 5, 602628, 58112, 0.1, 2, 1.94, "gnome-terminal-", "/usr/libexec/gnome-terminal-server", { protected: true }),
  p(1532, 1515, U, "Ss", 1, 10132, 5504, 0, 2, 0.12, "bash", "bash", { tty: "pts/0" }),
  p(1545, 1010, U, "Ssl", 6, 555876, 17152, 0, 2, 0.05, "xdg-desktop-por", "/usr/libexec/xdg-desktop-portal"),
  p(1552, 1010, U, "Ssl", 6, 601844, 34048, 0, 2, 0.12, "xdg-desktop-por", "/usr/libexec/xdg-desktop-portal-gnome"),
  p(1560, 1010, U, "Ssl", 6, 540924, 5376, 0, 2, 0, "xdg-document-po", "/usr/libexec/xdg-document-portal"),
  p(1566, 1560, "root", "Ss", 1, 2744, 1664, 0, 2, 0, "fusermount3", "fusermount3 -o rw,nosuid,nodev,fsname=portal,auto_unmount,subtype=portal -- /run/user/1000/doc"),
  p(1580, 1010, U, "SNsl", 6, 719392, 29440, 0, 2, 0.87, "localsearch-3", "/usr/libexec/localsearch-3"),
  p(1602, 1, U, "S", 1, 18504, 1920, 0, 2, 0, "VBoxClient", "/usr/bin/VBoxClient --clipboard"),
  p(1603, 1602, U, "Sl", 3, 150476, 4480, 0, 2, 0.21, "VBoxClient", "/usr/bin/VBoxClient --clipboard"),
  p(1606, 1, U, "S", 1, 18504, 1920, 0, 2, 0, "VBoxClient", "/usr/bin/VBoxClient --vmsvga-session"),
  p(1607, 1606, U, "Sl", 3, 150476, 4352, 0, 2, 0.34, "VBoxClient", "/usr/bin/VBoxClient --vmsvga-session"),
  p(1788, 1515, U, "Ss", 1, 10132, 5376, 0, 3, 0.03, "bash", "bash", { tty: "pts/1" }),
];

/** Hilos del kernel (hijos de kthreadd, PID 2). "R" en el nombre: workqueues de rescate de 6.12. */
const KERNEL: [number, string, string][] = [
  [2, "kthreadd", "S"],
  [3, "pool_workqueue_release", "S"],
  [4, "kworker/R-rcu_gp", "I<"],
  [5, "kworker/R-sync_wq", "I<"],
  [6, "kworker/R-kvfree_rcu_reclaim", "I<"],
  [7, "kworker/R-slub_flushwq", "I<"],
  [8, "kworker/R-netns", "I<"],
  [10, "kworker/0:0H-events_highpri", "I<"],
  [13, "kworker/R-mm_percpu_wq", "I<"],
  [14, "rcu_tasks_kthread", "I"],
  [15, "rcu_tasks_rude_kthread", "I"],
  [16, "rcu_tasks_trace_kthread", "I"],
  [17, "ksoftirqd/0", "S"],
  [18, "rcu_preempt", "I"],
  [19, "rcu_exp_par_gp_kthread_worker/0", "S"],
  [20, "rcu_exp_gp_kthread_worker", "S"],
  [21, "migration/0", "S"],
  [22, "idle_inject/0", "S"],
  [23, "cpuhp/0", "S"],
  [24, "cpuhp/1", "S"],
  [25, "idle_inject/1", "S"],
  [26, "migration/1", "S"],
  [27, "ksoftirqd/1", "S"],
  [29, "kworker/1:0H-events_highpri", "I<"],
  [30, "kdevtmpfs", "S"],
  [31, "kworker/R-inet_frag_wq", "I<"],
  [32, "kauditd", "S"],
  [33, "khungtaskd", "S"],
  [34, "oom_reaper", "S"],
  [35, "kworker/R-writeback", "I<"],
  [36, "kcompactd0", "S"],
  [37, "ksmd", "SN"],
  [38, "khugepaged", "SN"],
  [39, "kworker/R-kintegrityd", "I<"],
  [40, "kworker/R-kblockd", "I<"],
  [41, "kworker/R-blkcg_punt_bio", "I<"],
  [42, "irq/9-acpi", "S"],
  [43, "kworker/R-tpm_dev_wq", "I<"],
  [44, "kworker/R-edac-poller", "I<"],
  [45, "kworker/R-devfreq_wq", "I<"],
  [47, "kswapd0", "S"],
  [48, "kworker/R-kthrotld", "I<"],
  [49, "kworker/R-acpi_thermal_pm", "I<"],
  [50, "kworker/R-mld", "I<"],
  [51, "kworker/R-ipv6_addrconf", "I<"],
  [56, "kworker/R-kstrp", "I<"],
  [62, "kworker/u9:0", "I<"],
  [110, "kworker/R-ata_sff", "I<"],
  [111, "scsi_eh_0", "S"],
  [112, "kworker/R-scsi_tmf_0", "I<"],
  [113, "scsi_eh_1", "S"],
  [114, "kworker/R-scsi_tmf_1", "I<"],
  [116, "scsi_eh_2", "S"],
  [117, "kworker/R-scsi_tmf_2", "I<"],
  [119, "kworker/1:1H-kblockd", "I<"],
  [120, "kworker/0:1H-kblockd", "I<"],
  [150, "jbd2/sda1-8", "S"],
  [151, "kworker/R-ext4-rsv-conversion", "I<"],
  [205, "irq/18-vmwgfx", "S"],
  [206, "kworker/R-ttm", "I<"],
  ...Array.from({ length: 8 }, (_, i): [number, string, string] => [207 + i, `card0-crtc${i}`, "S"]),
  [243, "psimon", "S"],
  [290, "kworker/R-cryptd", "I<"],
  [455, "irq/19-enp0s3", "S"],
];

const TOTAL = 187;

/** Workers genéricos (creados más tarde, PIDs altos) hasta completar el total. */
function kernelFill(count: number): [number, string, string][] {
  const kinds = ["events", "mm_percpu_wq", "events_power_efficient", "events_freezable"];
  return Array.from({ length: count }, (_, i) => {
    const pid = 1640 + i * 7;
    // Nombres únicos: cada worker lleva su CPU (o u8 si no está ligado) y su número.
    const n = Math.floor(i / 3) + 2;
    const name = i % 3 === 2 ? `kworker/u8:${n}-events_unbound` : `kworker/${i % 3}:${n}-${kinds[i % kinds.length]}`;
    return [pid, name, i % 5 === 0 ? "I<" : "I"];
  });
}

export function baseProcesses(): BaseProc[] {
  const kernel = [...KERNEL, ...kernelFill(Math.max(0, TOTAL - USER_PROCESSES.length - KERNEL.length))];
  const kthreads = kernel.map(([pid, name, stat]) =>
    p(pid, pid === 2 ? 0 : 2, "root", stat, 1, 0, 0, 0, pid < 300 ? 0 : 3, 0, name.slice(0, 15), `[${name}]`, { kernel: true }),
  );
  return [...USER_PROCESSES, ...kthreads].sort((a, b) => a.pid - b.pid);
}
