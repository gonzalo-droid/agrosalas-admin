import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The panel cannot be shown inside another page (clickjacking) and the browser does not guess file types.
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
  // Server-side redirects: no "Cargando…" is shown for a page that only redirects.
  // The entry point of the panel is Attendance, the screen used most.
  async redirects() {
    return [
      { source: "/", destination: "/attendance", permanent: false },
      { source: "/settings", destination: "/settings/positions", permanent: false },
    ];
  },
};

export default nextConfig;
