import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El panel no se puede mostrar dentro de otra página (clickjacking) y el navegador no adivina tipos de archivo.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // Redirecciones en el servidor: no se ve "Cargando…" por una página que solo redirige.
  // Hasta que exista Planillas (fase 2), la entrada del panel es Trabajadores.
  async redirects() {
    return [
      { source: "/", destination: "/trabajadores", permanent: false },
      { source: "/configuracion", destination: "/configuracion/cargos", permanent: false },
    ];
  },
};

export default nextConfig;
