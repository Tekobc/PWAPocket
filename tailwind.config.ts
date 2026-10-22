import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        kt: {
          blue: "#0066FF",
          cyan: "#00F0FF",
          navy: "#0A1128",
          dark: "#0F172A",
        },
        etq: {
          yellow: "#FFD166",
          turquoise: "#06D6A0",
          cream: "#FEF9EF",
          coral: "#FF6B6B",
        },
      },
      fontFamily: {
        kt: ["Jost", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        etq: ["Bagel Fat One", "sans-serif"],
        poppins: ["Poppins", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
