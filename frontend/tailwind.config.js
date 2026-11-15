/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      // Design tokens from src/index.css, so `bg-accent-fill` or
      // `text-fg-muted` work instead of `bg-[var(--accent-fill)]`.
      colors: {
        bg: { DEFAULT: "var(--bg)", muted: "var(--bg-muted)" },
        surface: "var(--surface)",
        border: { DEFAULT: "var(--border)", strong: "var(--border-strong)" },
        fg: { DEFAULT: "var(--fg)", muted: "var(--fg-muted)", subtle: "var(--fg-subtle)" },
        accent: { DEFAULT: "var(--accent)", fg: "var(--accent-fg)", soft: "var(--accent-soft)", fill: "var(--accent-fill)", text: "var(--accent-text)" },
        danger: { DEFAULT: "var(--danger)", soft: "var(--danger-soft)" },
      },
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
      },
    }
  },
  plugins: [],
};