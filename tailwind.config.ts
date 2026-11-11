import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-instrument-sans)',
          '"Instrument Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        display: [
          '"General Sans"',
          'var(--font-instrument-sans)',
          '"Instrument Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: [
          'var(--font-jetbrains-mono)',
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        background: "#F8F8F6",
        card: "#FFFFFF",
        "card-border": "#E2E0D8",
        accent: {
          DEFAULT: "#0F52BA",
          hover: "#0C4196",
        },
      },
    },
  },
  plugins: [],
};

export default config;
