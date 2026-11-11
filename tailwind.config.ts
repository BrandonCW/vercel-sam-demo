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
          'var(--font-instrument-sans)',
          '"Instrument Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
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
      fontSize: {
        kicker: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.05em' }],
        score: ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
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
