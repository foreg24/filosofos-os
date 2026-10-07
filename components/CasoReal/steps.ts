/**
 * Guion del tutorial: cada paso muestra una pantalla de THAI·NOW (o del servidor), una explicación,
 * lo que ocurre internamente (aparece con el tiempo) y a dónde apunta el cursor.
 */

export type ScreenId =
  | "home"
  | "menu"
  | "product"
  | "cart"
  | "checkout"
  | "bank"
  | "waiting"
  | "server-hold"
  | "server-cycle"
  | "conditions"
  | "detect"
  | "solution"
  | "confirmed"
  | "summary";

export type LogTone = "default" | "ok" | "warn" | "alert" | "muted" | "code";

export interface Step {
  id: string;
  screen: ScreenId;
  url: string;
  /** Duración en ms antes de pasar solo al siguiente (0 = no avanza). */
  duration: number;
  chapter: string;
  title: string;
  body: string;
  /** Equivalencia con el problema clásico (se muestra como etiqueta). */
  mapping?: string;
  internal: { at: number; text: string; tone?: LogTone }[];
  /** Cursor: a qué elemento (data-tour) apunta y desde cuándo; click dibuja la pulsación. */
  actions?: { at: number; target: string; click?: boolean }[];
}

export const STEPS: Step[] = [
  {
    id: "home",
    screen: "home",
    url: "thainow.co",
    duration: 7000,
    chapter: "El pedido",
    title: "Viernes, 12:00 p. m. Hora pico.",
    body: "THAI·NOW es una app de domicilios. Ana abre la página para pedir almuerzo y, en el mismo segundo, otros cuatro clientes hacen lo mismo.",
    mapping: "5 clientes = 5 filósofos",
    internal: [
      { at: 400, text: "GET /  ·  200 OK  ·  38 ms", tone: "muted" },
      { at: 1600, text: "Sesiones activas: Ana, Beto, Caro, Dani, Eli" },
      { at: 3000, text: "Todos usan el mismo servidor y la misma base de datos de inventario." },
    ],
    actions: [{ at: 4600, target: "hero-cta", click: true }],
  },
  {
    id: "menu",
    screen: "menu",
    url: "thainow.co/menu",
    duration: 9500,
    chapter: "El pedido",
    title: "Cada plato necesita dos ingredientes",
    body: "Cada plato usa dos ingredientes del inventario, y cada ingrediente lo comparte con el plato vecino: Pad Thai y Tom Yum usan camarones, Tom Yum y Green Curry usan limonaria… y Satay Noodles cierra el círculo con los fideos del Pad Thai.",
    mapping: "Ingrediente = tenedor (recurso compartido)",
    internal: [
      { at: 500, text: "GET /api/menu  ·  5 platos", tone: "muted" },
      { at: 1500, text: "Pad Thai       → fideos + camarones" },
      { at: 2300, text: "Tom Yum        → camarones + limonaria" },
      { at: 3100, text: "Green Curry    → limonaria + coco" },
      { at: 3900, text: "Massaman Curry → coco + maní" },
      { at: 4700, text: "Satay Noodles  → maní + fideos", tone: "warn" },
    ],
    actions: [
      { at: 1200, target: "chips-0" },
      { at: 6400, target: "add-0", click: true },
    ],
  },
  {
    id: "product",
    screen: "product",
    url: "thainow.co/menu/pad-thai",
    duration: 9000,
    chapter: "El pedido",
    title: "Quedan las últimas unidades",
    body: "A esta hora el inventario está casi agotado: queda una porción de cada ingrediente. Para no vender algo que no existe, el servidor reserva cada ingrediente al confirmar el pedido. Mientras un pedido tiene la reserva, ningún otro puede tocar ese ingrediente.",
    mapping: "Reservar un ingrediente = tomar un tenedor",
    internal: [
      { at: 600, text: "inventario: 1 porción por ingrediente", tone: "warn" },
      { at: 1800, text: "Al confirmar, por cada ingrediente de la receta:" },
      { at: 2500, text: "SELECT stock FROM inventario WHERE id = ? FOR UPDATE;", tone: "code" },
      { at: 3800, text: "FOR UPDATE bloquea la fila hasta que la transacción termine (exclusión mutua)." },
    ],
    actions: [
      { at: 1000, target: "stock" },
      { at: 6200, target: "add-cart", click: true },
    ],
  },
  {
    id: "cart",
    screen: "cart",
    url: "thainow.co/carrito",
    duration: 5500,
    chapter: "El pedido",
    title: "Ana revisa su carrito",
    body: "Un Pad Thai y el domicilio. Todo normal: así se ve cualquier compra en línea.",
    internal: [
      { at: 500, text: "Carrito de Ana: 1 × Pad Thai", tone: "muted" },
      { at: 1500, text: "Total: $ 27.000 (incluye domicilio)" },
    ],
    actions: [{ at: 3200, target: "checkout", click: true }],
  },
  {
    id: "checkout",
    screen: "checkout",
    url: "thainow.co/checkout/pago",
    duration: 6000,
    chapter: "El pago",
    title: "Elige cómo pagar",
    body: "Ana escoge pagar con su banco. La página la redirige a la pasarela de pagos del banco, como en cualquier tienda.",
    internal: [
      { at: 600, text: "POST /api/checkout  ·  pedido TN4827 creado (pendiente)", tone: "muted" },
      { at: 2200, text: "Redirigiendo a la pasarela del banco…" },
    ],
    actions: [
      { at: 1300, target: "pay-bank", click: true },
      { at: 3800, target: "pay-continue", click: true },
    ],
  },
  {
    id: "bank",
    screen: "bank",
    url: "pagos.bancocolibri.co/boton",
    duration: 10000,
    chapter: "El pago",
    title: "El banco aprueba el pago",
    body: "Ana entra con su usuario y su clave y paga. El banco descuenta los $ 27.000 y le avisa a THAI·NOW que el pago fue aprobado. Hasta aquí, nada raro.",
    internal: [
      { at: 1000, text: "Banco Colibrí · autenticación OK", tone: "muted" },
      { at: 5600, text: "Transacción aprobada · $ 27.000", tone: "ok" },
      { at: 6600, text: "Webhook → thainow.co/api/pago  ·  aprobado", tone: "muted" },
      { at: 7600, text: "Ahora el servidor debe confirmar el pedido y reservar los ingredientes." },
    ],
    actions: [
      { at: 800, target: "bank-user" },
      { at: 2400, target: "bank-pass" },
      { at: 4300, target: "bank-pay", click: true },
    ],
  },
  {
    id: "waiting",
    screen: "waiting",
    url: "thainow.co/pedido/TN4827",
    duration: 8000,
    chapter: "El problema",
    title: "…pero la confirmación nunca llega",
    body: "El dinero ya salió de la cuenta de Ana, pero el pedido se queda en «Confirmando tu pedido». Lo mismo les pasa a Beto, Caro, Dani y Eli. Nadie recibe un error: solo esperan, y esperan.",
    internal: [
      { at: 800, text: "12:00:00.120  5 pedidos confirmándose a la vez", tone: "warn" },
      { at: 2600, text: "tiempo de respuesta: 3 s… 6 s… 9 s…", tone: "warn" },
      { at: 4600, text: "Veamos qué pasa dentro del servidor." },
    ],
  },
  {
    id: "server-hold",
    screen: "server-hold",
    url: "admin.thainow.co/servidor",
    duration: 10000,
    chapter: "Dentro del servidor",
    title: "Cada pedido reserva su primer ingrediente",
    body: "Cada confirmación es una transacción: un proceso. Las cinco empiezan en el mismo instante y cada una reserva el primer ingrediente de su receta. Las cinco reservas funcionan, porque cada una pide uno distinto.",
    mapping: "Pedido = proceso · Reserva = tomar un tenedor",
    internal: [
      { at: 1200, text: "T-Ana   BEGIN; … WHERE id = 'fideos'    FOR UPDATE  ✓", tone: "code" },
      { at: 2000, text: "T-Beto  BEGIN; … WHERE id = 'camarones' FOR UPDATE  ✓", tone: "code" },
      { at: 2800, text: "T-Caro  BEGIN; … WHERE id = 'limonaria' FOR UPDATE  ✓", tone: "code" },
      { at: 3600, text: "T-Dani  BEGIN; … WHERE id = 'coco'      FOR UPDATE  ✓", tone: "code" },
      { at: 4400, text: "T-Eli   BEGIN; … WHERE id = 'mani'      FOR UPDATE  ✓", tone: "code" },
      { at: 5600, text: "5 / 5 ingredientes bloqueados." },
    ],
  },
  {
    id: "server-cycle",
    screen: "server-cycle",
    url: "admin.thainow.co/servidor",
    duration: 11000,
    chapter: "Dentro del servidor",
    title: "Cada uno espera el ingrediente del otro",
    body: "Ahora cada transacción pide su segundo ingrediente… que ya bloqueó la transacción vecina. Ana espera los camarones de Beto, Beto la limonaria de Caro, y así hasta Eli, que espera los fideos de Ana. Es un círculo cerrado: nadie suelta lo que tiene y nadie puede avanzar.",
    mapping: "Esto es un deadlock",
    internal: [
      { at: 1000, text: "T-Ana   espera 'camarones'  (bloqueado por T-Beto)", tone: "warn" },
      { at: 1700, text: "T-Beto  espera 'limonaria'  (bloqueado por T-Caro)", tone: "warn" },
      { at: 2400, text: "T-Caro  espera 'coco'       (bloqueado por T-Dani)", tone: "warn" },
      { at: 3100, text: "T-Dani  espera 'mani'       (bloqueado por T-Eli)", tone: "warn" },
      { at: 3800, text: "T-Eli   espera 'fideos'     (bloqueado por T-Ana)", tone: "warn" },
      { at: 5400, text: "Ana → Beto → Caro → Dani → Eli → Ana", tone: "alert" },
      { at: 6400, text: "DEADLOCK: los 5 pedidos están bloqueados.", tone: "alert" },
    ],
  },
  {
    id: "conditions",
    screen: "conditions",
    url: "admin.thainow.co/servidor",
    duration: 13000,
    chapter: "¿Por qué pasó?",
    title: "Se cumplieron las 4 condiciones",
    body: "No fue mala suerte. El bloqueo solo es posible porque en el restaurante se cumplen, al mismo tiempo, las cuatro condiciones de Coffman.",
    internal: [
      { at: 1000, text: "1 · Exclusión mutua", tone: "default" },
      { at: 3500, text: "2 · Retención y espera", tone: "default" },
      { at: 6000, text: "3 · No expropiación", tone: "default" },
      { at: 8500, text: "4 · Espera circular", tone: "alert" },
    ],
  },
  {
    id: "detect",
    screen: "detect",
    url: "admin.thainow.co/servidor",
    duration: 10000,
    chapter: "¿Qué hace un sistema real?",
    title: "La base de datos detecta el ciclo",
    body: "Las bases de datos reales, como MySQL o PostgreSQL, revisan el grafo de espera. Cuando encuentran un ciclo, cancelan una transacción (la víctima) para liberar sus bloqueos. El sistema se recupera… pero a Eli le cancelan el pedido y tiene que esperar el reembolso.",
    mapping: "Detección y recuperación",
    internal: [
      { at: 1200, text: "InnoDB: deadlock detectado (5 transacciones)", tone: "warn" },
      { at: 2600, text: "ERROR 1213 (40001): Deadlock found when trying to get lock; try restarting transaction", tone: "alert" },
      { at: 4200, text: "ROLLBACK de T-Eli  ·  'maní' liberado", tone: "warn" },
      { at: 5600, text: "T-Dani continúa · el resto avanza en cadena", tone: "ok" },
      { at: 7000, text: "Eli: «No pudimos confirmar tu pedido. Te reembolsaremos.»", tone: "alert" },
    ],
  },
  {
    id: "solution",
    screen: "solution",
    url: "admin.thainow.co/servidor",
    duration: 14000,
    chapter: "La solución",
    title: "Reservar siempre en el mismo orden",
    body: "La corrección real es de diseño: cada pedido reserva sus ingredientes en orden de ID, del menor al mayor. Solo cambia Eli, que ahora pide primero los fideos (ID 1) y después el maní (ID 5). Así ninguna espera apunta hacia atrás y el círculo no se puede cerrar.",
    mapping: "Orden total de recursos",
    internal: [
      { at: 600, text: "- for (id of receta)", tone: "alert" },
      { at: 600, text: "+ for (id of receta.sort())   // menor ID primero", tone: "ok" },
      { at: 2200, text: "Mismos 5 pedidos, mismo instante (12:00:00.120)…", tone: "muted" },
      { at: 9500, text: "5 / 5 pedidos confirmados · 0 ciclos", tone: "ok" },
    ],
  },
  {
    id: "confirmed",
    screen: "confirmed",
    url: "thainow.co/pedido/TN4827",
    duration: 6500,
    chapter: "La solución",
    title: "¡Pedido confirmado!",
    body: "Con el arreglo, el pedido de Ana se confirma en milisegundos, igual que los de los otros cuatro clientes. Nadie se entera de lo que pasó por dentro: así debe ser.",
    internal: [
      { at: 600, text: "COMMIT  ·  pedido TN4827 confirmado", tone: "ok" },
      { at: 1600, text: "Enviado a cocina · llega en 35–45 min", tone: "ok" },
    ],
  },
  {
    id: "summary",
    screen: "summary",
    url: "thainow.co",
    duration: 0,
    chapter: "¿Qué pasó aquí?",
    title: "Los filósofos comensales, en una app de comida",
    body: "Cinco pedidos compitiendo por cinco ingredientes compartidos son exactamente cinco filósofos compitiendo por cinco tenedores. El problema de 1965 aparece hoy en cualquier sistema con bases de datos.",
    internal: [],
  },
];
