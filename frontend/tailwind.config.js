/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#141414",
        "surface-2": "#1c1c1c",
        border: "#222222",
        "border-accent": "#333333",
        foreground: "#FFFFFF",
        muted: "#555555",
        "text-secondary": "#999999",
        accent: "#CCFF00",
        "accent-hover": "#b8e600",
        "accent-dim": "rgba(204,255,0,0.125)",
        "accent-mid": "rgba(204,255,0,0.25)",
        success: "#00FF88",
        error: "#FF3B3B",
        warning: "#FFB800",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Bebas Neue", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        "shine-pulse": {
          "0%": { "background-position": "0% 0%" },
          "50%": { "background-position": "100% 100%" },
          to: { "background-position": "0% 0%" },
        },
      },
    },
  },
  plugins: [],
};
