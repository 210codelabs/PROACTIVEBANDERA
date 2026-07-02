import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff8ff",
          100: "#dbedff",
          200: "#bedfff",
          300: "#90cbff",
          400: "#5cafff",
          500: "#2f8eff",
          600: "#1872f0",
          700: "#125ddc",
          800: "#164bb1",
          900: "#17418c",
          950: "#122a55",
        },
        clinical: {
          green: "#10b981",
          amber: "#f59e0b",
          red: "#ef4444",
          violet: "#8b5cf6",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        chip: "0 1px 0 rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
