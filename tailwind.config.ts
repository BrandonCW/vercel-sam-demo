import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        card: "#121215",
        "card-border": "#27272a",
        accent: {
          DEFAULT: "#0070f3",
          hover: "#0060df",
        },
      },
    },
  },
  plugins: [],
};

export default config;
