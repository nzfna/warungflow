import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#EFF6FF", 100: "#DBEAFE", 600: "#2563EB", 700: "#1D4ED8", 900: "#172554" },
        accent: { 100: "#FEF3C7", 600: "#EA8A12" },
        page: "#F7F8FA", muted: "#F1F5F9", line: "#E2E8F0",
        ink: { DEFAULT: "#172033", 2: "#64748B", 3: "#94A3B8" },
        ok: { DEFAULT: "#15803D", bg: "#DCFCE7" },
        warn: { DEFAULT: "#B45309", bg: "#FEF3C7" },
        bad: { DEFAULT: "#B91C1C", bg: "#FEE2E2" },
        info: { DEFAULT: "#1D4ED8", bg: "#DBEAFE" },
        w: {
          capital: "#D97706", "capital-bg": "#FFF7E6",
          operations: "#2563EB", "operations-bg": "#EFF6FF",
          owner: "#6D5BD0", "owner-bg": "#F1EFFF",
          growth: "#15803D", "growth-bg": "#ECFDF3",
        },
      },
      fontFamily: { sans: ["var(--font-jakarta)", "system-ui", "sans-serif"] },
      borderRadius: { control: "8px", card: "12px", dialog: "16px" },
      spacing: { sidebar: "240px", header: "68px" },
    },
  },
  plugins: [],
} satisfies Config;
