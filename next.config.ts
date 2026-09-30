import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Política de contenido: solo se carga lo que sirve este mismo sitio. Sin nonces para que la
 * página siga siendo estática (rápida). 'unsafe-eval' solo en desarrollo (lo exige React allí).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // En build se genera un sitio 100 % estático en /out (Cloudflare Pages). Las cabeceras de
  // seguridad de producción viven en public/_headers, porque la exportación estática no usa headers().
  output: isDev ? undefined : "export",
  devIndicators: false,
  // No se anuncia la tecnología del servidor (cabecera x-powered-by).
  poweredByHeader: false,
  // Nunca se publican los mapas de código fuente: en el navegador solo llega el código compilado.
  productionBrowserSourceMaps: false,
  images: {
    // Sin servidor no hay optimizador de imágenes: se sirven tal cual.
    unoptimized: true,
  },
  // Solo en desarrollo (next dev); en producción las aplica Cloudflare desde public/_headers.
  ...(isDev && { headers: async () => [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Al salir hacia otro sitio no se envía la dirección de esta página.
          { key: "Referrer-Policy", value: "no-referrer" },
          // Nadie puede incrustar la página en otro sitio.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ] }),
};

export default nextConfig;
