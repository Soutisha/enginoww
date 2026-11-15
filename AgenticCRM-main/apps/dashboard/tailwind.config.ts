import type { Config } from 'tailwindcss';

const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Layered surfaces
        canvas: token('canvas'),
        panel: token('panel'),
        raised: token('raised'),
        overlay: token('overlay'),
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        // Text
        ink: { DEFAULT: token('text'), dim: token('text-dim'), faint: token('text-faint') },
        // Semantic
        signal: { DEFAULT: token('signal'), soft: token('signal-soft') },
        cyan: token('cyan'),
        positive: token('positive'),
        negative: token('negative'),
        warning: token('warning'),
        // shadcn-compatible (existing pages)
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
        destructive: { DEFAULT: token('destructive'), foreground: token('destructive-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
      },
      fontFamily: { sans: ['var(--font-ui)'] },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        panel: '1rem',
      },
      boxShadow: {
        // One deliberate elevation, not a shadow on everything.
        raise: '0 1px 0 0 hsl(0 0% 100% / 0.04) inset, 0 12px 32px -16px hsl(228 60% 2% / 0.8)',
        glow: '0 0 0 1px hsl(var(--signal) / 0.35), 0 8px 40px -8px hsl(var(--signal) / 0.45)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
