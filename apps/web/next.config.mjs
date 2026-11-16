/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL || "http://localhost:4000";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

export default {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@warungflow/shared"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Satu origin untuk browser: /api/* diteruskan ke Express, sehingga cookie httpOnly aman.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};
