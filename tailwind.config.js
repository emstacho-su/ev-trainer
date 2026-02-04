/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        appBg: "var(--color-bg)",
        surface: "var(--color-surface-1)",
        surfaceMuted: "var(--color-surface-2)",
        textPrimary: "var(--color-text-primary)",
        textSecondary: "var(--color-text-secondary)",
        borderSubtle: "var(--color-border-subtle)",
        actionPrimary: "var(--color-action-primary)",
        evPositive: "var(--color-ev-positive)",
        evNeutral: "var(--color-ev-neutral)",
        evNegative: "var(--color-ev-negative)",
      },
      spacing: {
        tok1: "var(--space-1)",
        tok2: "var(--space-2)",
        tok3: "var(--space-3)",
        tok4: "var(--space-4)",
        tok5: "var(--space-5)",
        tok6: "var(--space-6)",
      },
      borderRadius: {
        tokSm: "var(--radius-sm)",
        tokMd: "var(--radius-md)",
        tokLg: "var(--radius-lg)",
        tokXl: "var(--radius-xl)",
      },
      boxShadow: {
        tok1: "var(--shadow-1)",
        tok2: "var(--shadow-2)",
      },
      fontSize: {
        tokXs: "var(--font-size-xs)",
        tokSm: "var(--font-size-sm)",
        tokMd: "var(--font-size-md)",
        tokLg: "var(--font-size-lg)",
        tokXl: "var(--font-size-xl)",
      },
    },
  },
  plugins: [],
};
