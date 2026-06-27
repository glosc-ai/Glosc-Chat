import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#121417",
          900: "#1b2025",
          700: "#3a4149",
          500: "#68717d"
        },
        moss: {
          700: "#2f6f62",
          600: "#3d8b79",
          100: "#e1f1ec"
        },
        sun: {
          500: "#f2b84b",
          100: "#fff1cc"
        },
        clay: {
          500: "#d96f55",
          100: "#ffe6dc"
        }
      },
      boxShadow: {
        soft: "0 24px 70px rgba(18, 20, 23, 0.12)"
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
} satisfies Config;
