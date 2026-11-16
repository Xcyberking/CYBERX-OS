import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {
    colors: {
      ink: "#070b14",
      panel: "#0d1422",
      line: "rgba(148,163,184,.13)",
      cyanx: "#22d3ee",
      violetx: "#8b5cf6"
    },
    boxShadow: { glow: "0 0 35px rgba(34,211,238,.12)" }
  }},
  plugins: []
};
export default config;