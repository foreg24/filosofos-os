/**
 * Pantallas de THAI·NOW (tienda) y de la pasarela de Banco Colibrí, dibujadas a 1200 × 720.
 * Cada pantalla recibe `t` (ms desde que empezó el paso) y deriva de ahí su estado:
 * así el tutorial puede pausarse, retroceder o repetirse sin desincronizarse.
 */
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bike,
  Check,
  ChefHat,
  ChevronRight,
  Clock,
  CreditCard,
  Leaf,
  LoaderCircle,
  Lock,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { CUSTOMERS, DELIVERY, ORDER_NUMBER, money, recipeOf } from "./data";

const after = (t: number, ms: number) => t >= ms;
const PAD_THAI = CUSTOMERS[0];
const TOTAL = PAD_THAI.price + DELIVERY;

/* ------------------------------------------------------------- marca -- */

export function Lotus({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M16 6c3 3.4 3 9.6 0 14-3-4.4-3-10.6 0-14Z" />
      <path d="M16 20c-1.6-4.8-5.2-8-10-8.6.6 5 4.4 8.6 10 8.6Z" />
      <path d="M16 20c1.6-4.8 5.2-8 10-8.6-.6 5-4.4 8.6-10 8.6Z" />
      <path d="M6 21.5c3 2.6 6.4 3.4 10 3.4s7-.8 10-3.4" />
    </svg>
  );
}

function Header({ dark = false, cart = 0, active = "Inicio" }: { dark?: boolean; cart?: number; active?: string }) {
  const ink = dark ? "text-white" : "text-[#1B2A21]";
  return (
    <header className={`flex h-[64px] items-center justify-between px-10 ${dark ? "" : "border-b border-[#E6E4DC] bg-white/80"}`}>
      <div className={`flex items-center gap-3 ${ink}`}>
        <Lotus className={`h-8 w-8 ${dark ? "text-[#9BD06B]" : "text-[#1F5E3B]"}`} />
        <div className="leading-none">
          <p className="text-[15px] font-semibold tracking-[0.32em]">THAI·NOW</p>
          <p className={`mt-1 text-[8px] tracking-[0.28em] ${dark ? "text-white/60" : "text-[#6B7468]"}`}>AUTÉNTICO SABOR TAILANDÉS</p>
        </div>
      </div>
      <nav className={`flex gap-9 text-[13px] ${dark ? "text-white/80" : "text-[#3D4A40]"}`}>
        {["Inicio", "Menú", "Nosotros", "Contacto"].map((l) => (
          <span key={l} className={l === active ? `font-semibold ${dark ? "text-white" : "text-[#1F5E3B]"}` : ""}>
            {l}
          </span>
        ))}
      </nav>
      <div className={`flex items-center gap-5 ${ink}`}>
        <Search size={17} />
        <span className="relative">
          <ShoppingBag size={17} />
          {cart > 0 && <span className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-[#E4572E] text-[9px] font-bold text-white">{cart}</span>}
        </span>
        <User size={17} />
      </div>
    </header>
  );
}

function Page({ children, cart = 0, active = "Menú" }: { children: React.ReactNode; cart?: number; active?: string }) {
  return (
    <div className="flex h-full flex-col bg-[#F7F6F1] text-[#1B2A21]">
      <Header cart={cart} active={active} />
      <div className="relative flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

const GreenButton = ({ children, pressed, className = "", tour }: { children: React.ReactNode; pressed?: boolean; className?: string; tour?: string }) => (
  <span
    data-tour={tour}
    className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[#1F5E3B] font-semibold text-white transition-transform duration-150 ${pressed ? "scale-[0.97] bg-[#174A2E]" : ""} ${className}`}
  >
    {children}
  </span>
);

/* -------------------------------------------------------------- inicio -- */

export function HomeScreen({ t }: { t: number }) {
  return (
    <div className="relative h-full overflow-hidden bg-[#0E1A12] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/caso/hero.webp" alt="" className="absolute inset-y-0 right-0 h-full w-[68%] object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#0E1A12_34%,rgba(14,26,18,0.85)_52%,rgba(14,26,18,0.2)_100%)]" />
      <div className="relative">
        <Header dark active="Inicio" />
      </div>
      <div className="relative px-14 pt-24">
        <h2 className="max-w-[540px] text-[44px] font-semibold leading-[1.08] tracking-[-0.02em]">
          El verdadero <span className="text-[#9BD06B]">sabor de Tailandia,</span> en la puerta de tu casa
        </h2>
        <p className="mt-5 max-w-[380px] text-[15px] leading-relaxed text-white/75">Platos frescos, ingredientes auténticos y todo el sabor thai, sin salir de casa.</p>
        <span
          data-tour="hero-cta"
          className={`mt-8 inline-flex items-center gap-2 rounded-lg bg-[#9BD06B] px-6 py-3 text-[14px] font-semibold text-[#14301F] transition-transform ${after(t, 4600) ? "scale-95" : ""}`}
        >
          Ver menú <ArrowRight size={16} />
        </span>
      </div>
      <div className="absolute inset-x-14 bottom-10 flex gap-14 text-[12px]">
        {[
          [Bike, "Envíos rápidos", "En menos de 45 min"],
          [Leaf, "Ingredientes frescos", "100 % naturales"],
          [ShieldCheck, "Pago seguro", "Tus datos protegidos"],
        ].map(([Icon, title, sub]) => {
          const I = Icon as typeof Bike;
          return (
            <div key={title as string} className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-white/25">
                <I size={17} />
              </span>
              <div>
                <p className="font-semibold">{title as string}</p>
                <p className="text-white/60">{sub as string}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute right-8 top-20 rounded-full bg-black/55 px-4 py-2 text-[12px] backdrop-blur">
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#F2B544]" />
        Hora pico · 5 clientes en línea
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- menú -- */

export function MenuScreen({ t }: { t: number }) {
  const categories = ["Todos", "Entradas", "Platos principales", "Arroces y noodles", "Sopas", "Postres", "Bebidas"];
  return (
    <Page>
      <div className="flex h-full">
        <aside className="w-[210px] border-r border-[#E6E4DC] px-6 py-8">
          {categories.map((c, i) => (
            <p key={c} className={`mb-1 rounded-lg px-3 py-2.5 text-[13px] ${i === 0 ? "bg-[#EEF3EA] font-semibold text-[#1F5E3B]" : "text-[#55604F]"}`}>
              {c}
            </p>
          ))}
        </aside>
        <main className="flex-1 px-10 py-7">
          <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Nuestro menú</h2>
          <p className="mt-1 text-[13px] text-[#6B7468]">Descubre la esencia de la cocina tailandesa.</p>
          <div className="mt-5 grid grid-cols-3 gap-5">
            {CUSTOMERS.map((d) => {
              const [a, b] = recipeOf(d.id);
              const highlight = d.id === 0 && after(t, 1200);
              return (
                <article key={d.id} className="overflow-hidden rounded-xl border border-[#E6E4DC] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.image} alt="" className="h-[118px] w-full object-cover" />
                  <div className="p-3.5">
                    <p className="text-[14px] font-semibold">{d.dish}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[#6B7468]">{d.description}</p>
                    <div data-tour={`chips-${d.id}`} className={`mt-2 flex gap-1.5 rounded-md transition-shadow ${highlight ? "shadow-[0_0_0_3px_rgba(242,181,68,0.55)]" : ""}`}>
                      {[a, b].map((ing) => (
                        <span key={ing.id} className="rounded-full bg-[#F3EFE3] px-2 py-0.5 text-[10px] font-medium text-[#7A5B1E]">
                          {ing.short}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[13px] font-semibold">{money(d.price)}</span>
                      <GreenButton tour={`add-${d.id}`} pressed={d.id === 0 && after(t, 6400)} className="px-4 py-1.5 text-[11px]">
                        {d.id === 0 && after(t, 6600) ? (
                          <>
                            <Check size={12} /> Agregado
                          </>
                        ) : (
                          "Agregar"
                        )}
                      </GreenButton>
                    </div>
                  </div>
                </article>
              );
            })}
            <article className="flex flex-col justify-between rounded-xl bg-[#1F5E3B] p-5 text-white">
              <Zap className="text-[#F2B544]" size={22} />
              <div>
                <p className="text-[16px] font-semibold leading-snug">Hora pico</p>
                <p className="mt-2 text-[12px] leading-relaxed text-white/75">Alta demanda en este momento. Quedan pocas porciones de cada ingrediente.</p>
              </div>
            </article>
          </div>
        </main>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------ detalle -- */

export function ProductScreen({ t }: { t: number }) {
  const [a, b] = recipeOf(0);
  const added = after(t, 6400);
  return (
    <Page cart={added ? 1 : 0}>
      <div className="px-14 py-6">
        <p className="flex items-center gap-1.5 text-[12px] text-[#1F5E3B]">
          <ArrowLeft size={13} /> Volver al menú
        </p>
        <div className="mt-4 grid grid-cols-[440px_1fr] gap-12">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PAD_THAI.image} alt="" className="h-[400px] w-full rounded-2xl object-cover" />
          </div>
          <div>
            <h2 className="text-[30px] font-semibold tracking-[-0.02em]">Pad Thai</h2>
            <p className="mt-1 text-[22px] font-semibold">{money(PAD_THAI.price)}</p>
            <p className="mt-3 max-w-[460px] text-[13px] leading-relaxed text-[#55604F]">{PAD_THAI.description}</p>

            <div data-tour="stock" className={`mt-5 max-w-[460px] rounded-xl border bg-white p-4 transition-shadow ${after(t, 1000) ? "border-[#F2B544] shadow-[0_0_0_4px_rgba(242,181,68,0.25)]" : "border-[#E6E4DC]"}`}>
              <p className="flex items-center justify-between text-[12px] font-semibold">
                Inventario en tiempo real
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#B4541A]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E4572E]" /> Últimas unidades
                </span>
              </p>
              {[a, b].map((ing) => (
                <div key={ing.id} className="mt-2.5 flex items-center justify-between border-t border-[#F0EEE6] pt-2.5 text-[12px]">
                  <span>{ing.name}</span>
                  <span className="font-semibold text-[#B4541A]">Queda 1 porción</span>
                </div>
              ))}
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#6B7468]">
                <Lock size={11} /> Se reservan para ti al confirmar el pedido.
              </p>
            </div>

            <div className="mt-5 flex items-center gap-10 text-[12px]">
              <div>
                <p className="mb-2 font-semibold">Cantidad</p>
                <div className="flex items-center gap-4 rounded-lg border border-[#E6E4DC] bg-white px-3 py-1.5">
                  <Minus size={13} /> 1 <Plus size={13} />
                </div>
              </div>
              <div>
                <p className="mb-2 font-semibold">Nivel de picante</p>
                <div className="flex gap-2">
                  {["Suave", "Medio", "Picante"].map((p, i) => (
                    <span key={p} className={`rounded-lg border px-4 py-1.5 ${i === 0 ? "border-[#1F5E3B] bg-[#EEF3EA] font-semibold text-[#1F5E3B]" : "border-[#E6E4DC] bg-white"}`}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <GreenButton tour="add-cart" pressed={added} className="mt-6 w-[460px] py-3.5 text-[14px]">
              {added ? (
                <>
                  <Check size={16} /> Agregado al carrito
                </>
              ) : (
                "Agregar al carrito"
              )}
            </GreenButton>
          </div>
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------ carrito -- */

export function CartScreen({ t }: { t: number }) {
  return (
    <Page cart={1}>
      <div className="grid grid-cols-[1fr_380px] gap-10 px-14 py-8">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Tu carrito</h2>
          <div className="mt-6 flex items-center gap-5 rounded-xl border border-[#E6E4DC] bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PAD_THAI.image} alt="" className="h-20 w-20 rounded-lg object-cover" />
            <div className="flex-1">
              <p className="text-[15px] font-semibold">Pad Thai</p>
              <p className="text-[12px] text-[#6B7468]">Picante suave</p>
              <p className="mt-1 text-[13px] font-semibold">{money(PAD_THAI.price)}</p>
            </div>
            <div className="flex items-center gap-4 rounded-lg border border-[#E6E4DC] px-3 py-1.5 text-[12px]">
              <Minus size={13} /> 1 <Plus size={13} />
            </div>
            <Trash2 size={16} className="text-[#8A928A]" />
          </div>
          <p className="mt-5 flex items-center gap-2 text-[12px] text-[#1F5E3B]">
            <ArrowLeft size={13} /> Seguir comprando
          </p>
        </div>
        <div className="h-fit rounded-xl bg-[#EFEDE5] p-6">
          <p className="text-[14px] font-semibold">Resumen del pedido</p>
          {[
            ["Subtotal", money(PAD_THAI.price)],
            ["Domicilio", money(DELIVERY)],
          ].map(([k, v]) => (
            <p key={k} className="mt-4 flex justify-between text-[13px] text-[#55604F]">
              {k} <span>{v}</span>
            </p>
          ))}
          <p className="mt-5 flex justify-between border-t border-[#DAD7CC] pt-4 text-[18px] font-semibold">
            Total <span>{money(TOTAL)}</span>
          </p>
          <GreenButton tour="checkout" pressed={after(t, 3200)} className="mt-6 w-full py-3 text-[13px]">
            Continuar con el pago
          </GreenButton>
        </div>
      </div>
    </Page>
  );
}

/* ----------------------------------------------------------- checkout -- */

export function CheckoutScreen({ t }: { t: number }) {
  const bank = after(t, 1300);
  const leaving = after(t, 3800);
  const methods = [
    { id: "card", icon: CreditCard, label: "Tarjeta de crédito o débito" },
    { id: "bank", icon: ColibriMark, label: "Banco Colibrí · Botón de pagos" },
    { id: "cash", icon: Banknote, label: "Pago contra entrega" },
  ];
  return (
    <Page cart={1}>
      <div className="px-14 py-7">
        <div className="mx-auto flex max-w-[640px] items-center justify-between text-[11px]">
          {["Dirección", "Pago", "Confirmación"].map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-[#1F5E3B] text-white" : i === 1 ? "border-2 border-[#1F5E3B] text-[#1F5E3B]" : "border border-[#C9C6BA] text-[#8A928A]"}`}>
                {i === 0 ? <Check size={12} /> : i + 1}
              </span>
              <span className={i === 1 ? "font-semibold text-[#1F5E3B]" : "text-[#6B7468]"}>{s}</span>
              {i < 2 && <span className="mx-3 h-px flex-1 bg-[#DAD7CC]" />}
            </div>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-[1fr_360px] gap-10">
          <div>
            <p className="text-[16px] font-semibold">Método de pago</p>
            <div className="mt-4 space-y-3">
              {methods.map((m) => {
                const selected = m.id === "bank" && bank;
                const Icon = m.icon;
                return (
                  <div
                    key={m.id}
                    data-tour={m.id === "bank" ? "pay-bank" : undefined}
                    className={`flex items-center gap-4 rounded-xl border bg-white px-5 py-4 text-[13px] ${selected ? "border-[#1F5E3B] shadow-[0_0_0_3px_rgba(31,94,59,0.12)]" : "border-[#E6E4DC]"}`}
                  >
                    <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${selected ? "border-[#1F5E3B]" : "border-[#C9C6BA]"}`}>
                      {selected && <span className="h-2.5 w-2.5 rounded-full bg-[#1F5E3B]" />}
                    </span>
                    <Icon size={20} className="text-[#3D4A40]" />
                    {m.label}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="h-fit rounded-xl border border-[#E6E4DC] bg-white p-6">
            <p className="text-[14px] font-semibold">Tu pedido</p>
            <p className="mt-4 flex justify-between text-[13px] text-[#55604F]">
              1 × Pad Thai <span>{money(PAD_THAI.price)}</span>
            </p>
            <p className="mt-2 flex justify-between text-[13px] text-[#55604F]">
              Domicilio <span>{money(DELIVERY)}</span>
            </p>
            <p className="mt-4 flex justify-between border-t border-[#F0EEE6] pt-4 text-[17px] font-semibold">
              Total <span>{money(TOTAL)}</span>
            </p>
            <GreenButton tour="pay-continue" pressed={leaving} className="mt-6 w-full py-3 text-[13px]">
              {leaving ? (
                <>
                  <LoaderCircle size={15} className="animate-spin" /> Redirigiendo al banco…
                </>
              ) : (
                <>
                  Pagar con Banco Colibrí <ChevronRight size={15} />
                </>
              )}
            </GreenButton>
          </div>
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------------------------- pasarela del banco -- */

/** Marca de Banco Colibrí (entidad inventada): un colibrí estilizado sobre amarillo. */
export function ColibriMark({ size = 20, className = "", inverted = false }: { size?: number; className?: string; inverted?: boolean }) {
  const [disc, bird] = inverted ? ["#2C2A29", "#FDDA24"] : ["#FDDA24", "#2C2A29"];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill={disc} />
      <path d="M5 13.5c3.5-.4 6-2.2 7.6-5.2.4 2 .1 3.6-.8 4.9l5.7-1.7-4.9 3.3c-2.6 1.6-5.3 1.2-7.6-1.3Z" fill={bird} />
      <circle cx="15.3" cy="9.6" r="0.9" fill={bird} />
    </svg>
  );
}

export function BankScreen({ t }: { t: number }) {
  const user = "ana.martinez";
  const typedUser = user.slice(0, Math.max(0, Math.min(user.length, Math.floor((t - 800) / 110))));
  const pin = Math.max(0, Math.min(4, Math.floor((t - 2400) / 350)));
  const paying = after(t, 4300) && !after(t, 5600);
  const done = after(t, 5600);
  return (
    <div className="flex h-full flex-col bg-[#F4F4F4] text-[#2C2A29]">
      <header className="flex h-[64px] items-center justify-between bg-[#FDDA24] px-10">
        <div className="flex items-center gap-3">
          <ColibriMark size={34} inverted />
          <p className="text-[19px] font-extrabold tracking-[-0.01em]">Banco Colibrí</p>
        </div>
        <p className="flex items-center gap-2 text-[12px] font-semibold">
          <Lock size={13} /> Conexión segura
        </p>
      </header>
      <div className="px-16 py-8">
        <h2 className="text-[26px] font-extrabold tracking-[-0.02em]">Botón de pagos</h2>
        <p className="mt-1 text-[13px] text-[#59595B]">Paga tus compras en línea directamente desde tu cuenta.</p>
        <div className="mt-6 grid grid-cols-[380px_1fr] gap-8">
          <div className="h-fit rounded-[20px] bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <p className="text-[13px] font-bold">Resumen de tu compra</p>
            {[
              ["Comercio", "THAI·NOW S.A.S."],
              ["Referencia", ORDER_NUMBER],
              ["Descripción", "Pedido en línea"],
            ].map(([k, v]) => (
              <p key={k} className="mt-3.5 flex justify-between text-[13px]">
                <span className="text-[#59595B]">{k}</span>
                <span className="font-semibold">{v}</span>
              </p>
            ))}
            <div className="mt-5 rounded-2xl bg-[#FFF6CC] px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#59595B]">Valor a pagar</p>
              <p className="mt-1 text-[26px] font-extrabold">{money(TOTAL)}</p>
            </div>
          </div>

          <div className="rounded-[20px] bg-white p-7 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            {!done ? (
              <>
                <p className="text-[16px] font-bold">Ingresa a tu cuenta</p>
                <p className="mt-1 text-[12px] text-[#59595B]">Usa el mismo usuario y clave de la app de Banco Colibrí.</p>
                <label className="mt-5 block text-[12px] font-semibold">Usuario</label>
                <div data-tour="bank-user" className="mt-1.5 flex h-11 items-center rounded-xl border-2 border-[#2C2A29] px-4 text-[14px]">
                  {typedUser}
                  {t > 800 && t < 2400 && <span className="ml-0.5 h-4 w-px animate-pulse bg-[#2C2A29]" />}
                </div>
                <label className="mt-4 block text-[12px] font-semibold">Clave (4 dígitos)</label>
                <div data-tour="bank-pass" className="mt-1.5 flex h-11 items-center gap-3 rounded-xl border-2 border-[#D4D4D4] px-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < pin ? "bg-[#2C2A29]" : "bg-[#D4D4D4]"}`} />
                  ))}
                </div>
                <span
                  data-tour="bank-pay"
                  className={`mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold transition-colors ${paying ? "bg-[#59595B] text-white" : "bg-[#2C2A29] text-white"}`}
                >
                  {paying ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" /> Procesando pago…
                    </>
                  ) : (
                    `Pagar ${money(TOTAL)}`
                  )}
                </span>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-[#00825A] text-white">
                  <Check size={32} strokeWidth={3} />
                </span>
                <p className="mt-4 text-[22px] font-extrabold">¡Pago exitoso!</p>
                <p className="mt-1 text-[13px] text-[#59595B]">Pagaste {money(TOTAL)} a THAI·NOW S.A.S.</p>
                <p className="mt-4 rounded-xl bg-[#F4F4F4] px-4 py-2 text-[12px]">
                  Comprobante <span className="font-bold">No. 0048213</span>
                </p>
                <span className="mt-6 rounded-full border-2 border-[#2C2A29] px-6 py-2.5 text-[13px] font-bold">Volver al comercio</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- pedido en espera -- */

export function WaitingScreen({ t }: { t: number }) {
  const seconds = Math.floor(t / 1000);
  const timeline: { label: string; state: "done" | "stuck" | "todo" }[] = [
    { label: "Pago aprobado · Banco Colibrí", state: "done" },
    { label: "Reservando ingredientes", state: "stuck" },
    { label: "Enviando a la cocina", state: "todo" },
    { label: "En camino", state: "todo" },
  ];
  return (
    <Page cart={0} active="Inicio">
      <div className="grid grid-cols-[1fr_330px] gap-8 px-14 py-9">
        <div className="rounded-2xl border border-[#E6E4DC] bg-white p-8">
          <div className="flex items-center gap-4">
            <LoaderCircle size={34} className="animate-spin text-[#1F5E3B]" />
            <div>
              <p className="text-[24px] font-semibold tracking-[-0.02em]">Confirmando tu pedido…</p>
              <p className="text-[13px] text-[#6B7468]">
                Pedido #{ORDER_NUMBER} · 1 × Pad Thai · {money(TOTAL)}
              </p>
            </div>
          </div>
          <div className="mt-8 space-y-5">
            {timeline.map((s) => (
              <div key={s.label} className="flex items-center gap-4 text-[14px]">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full ${s.state === "done" ? "bg-[#1F5E3B] text-white" : s.state === "stuck" ? "border-2 border-[#F2B544] text-[#B4541A]" : "border border-[#D6D3C7]"}`}
                >
                  {s.state === "done" ? <Check size={14} /> : s.state === "stuck" ? <LoaderCircle size={14} className="animate-spin" /> : null}
                </span>
                <span className={s.state === "todo" ? "text-[#9AA096]" : ""}>{s.label}</span>
                {s.state === "stuck" && <span className="ml-auto rounded-full bg-[#FFF4DD] px-3 py-1 text-[11px] font-semibold text-[#B4541A]">esperando…</span>}
              </div>
            ))}
          </div>
          <p className="mt-9 flex items-center gap-2 text-[13px] text-[#B4541A]">
            <Clock size={15} /> Llevas esperando 00:{String(seconds + 4).padStart(2, "0")}
          </p>
        </div>
        <div className="rounded-2xl bg-[#1F5E3B] p-6 text-white">
          <p className="text-[13px] font-semibold">Otros pedidos en este momento</p>
          <div className="mt-4 space-y-3">
            {CUSTOMERS.slice(1).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-[12px]">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 font-semibold">{c.name[0]}</span>
                <div className="flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-white/65">{c.dish}</p>
                </div>
                <LoaderCircle size={15} className="animate-spin text-[#F2B544]" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-white/60">Todos pagaron. Ninguno ha sido confirmado.</p>
        </div>
      </div>
    </Page>
  );
}

/* ----------------------------------------------------------- confirmado -- */

export function ConfirmedScreen({ t }: { t: number }) {
  return (
    <div className="relative h-full overflow-hidden bg-[#0E1A12] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/caso/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
      <div className="relative">
        <Header dark active="Inicio" />
      </div>
      <div className="relative flex flex-col items-center px-10 pt-14 text-center">
        <span className={`grid h-20 w-20 place-items-center rounded-full border-2 border-[#9BD06B] text-[#9BD06B] transition-transform duration-500 ${after(t, 200) ? "scale-100" : "scale-75"}`}>
          <Check size={38} strokeWidth={2.5} />
        </span>
        <h2 className="mt-6 text-[36px] font-semibold tracking-[-0.02em]">¡Pedido confirmado!</h2>
        <p className="mt-3 max-w-[460px] text-[14px] leading-relaxed text-white/75">Tu comida está en camino. En unos minutos recibirás la confirmación con el número de seguimiento.</p>
        <div className="mt-8 grid w-[480px] grid-cols-2 rounded-2xl border border-white/15 bg-black/30 px-6 py-5 text-left backdrop-blur">
          <div>
            <p className="text-[11px] text-white/60">Número de pedido</p>
            <p className="mt-1 text-[18px] font-semibold">#{ORDER_NUMBER}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/60">Tiempo estimado de entrega</p>
            <p className="mt-1 text-[18px] font-semibold">35 – 45 min</p>
          </div>
        </div>
        <span className="mt-8 flex items-center gap-2 rounded-lg bg-[#9BD06B] px-8 py-3 text-[13px] font-semibold text-[#14301F]">
          <ChefHat size={16} /> Ver estado del pedido
        </span>
      </div>
    </div>
  );
}
