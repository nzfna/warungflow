/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL || "http://localhost:4000";

export default {
  reactStrictMode: true,
  transpilePackages: ["@warungflow/shared"],
  // Satu origin untuk browser: /api/* diteruskan ke Express, sehingga cookie httpOnly aman.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};
