import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Topla "paper" pozadina + tamni "ink" tekst
        paper: "#FAF7F2",
        ink: {
          DEFAULT: "#1A1816",
          soft: "#4A463F",
          faint: "#8A8478",
        },
        // Glavna brand boja - duboki teal/zelena (wellness vibe)
        brand: {
          50: "#EAF3F0",
          100: "#CFE3DD",
          400: "#3E9685",
          500: "#1B7A6A",
          600: "#13544A",
          700: "#0E3F38",
        },
        // Akcent - topli amber za male naglaske
        amber: {
          400: "#E0A458",
          500: "#C98A38",
        },
        line: "#E7E0D4",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,24,22,0.04), 0 8px 24px -12px rgba(26,24,22,0.12)",
        lift: "0 12px 40px -16px rgba(19,84,74,0.35)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
