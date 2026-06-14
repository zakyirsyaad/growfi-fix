import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: 'oklch(var(--border) / <alpha-value>)',
        input: 'oklch(var(--input) / <alpha-value>)',
        ring: 'oklch(var(--ring) / <alpha-value>)',
        background: 'oklch(var(--background) / <alpha-value>)',
        foreground: 'oklch(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
          foreground: 'oklch(var(--primary-foreground) / <alpha-value>)'
        },
        secondary: {
          DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
          foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)'
        },
        destructive: {
          DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
          foreground: 'oklch(var(--destructive-foreground) / <alpha-value>)'
        },
        muted: {
          DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
          foreground: 'oklch(var(--muted-foreground) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
          foreground: 'oklch(var(--accent-foreground) / <alpha-value>)'
        },
        popover: {
          DEFAULT: 'oklch(var(--popover) / <alpha-value>)',
          foreground: 'oklch(var(--popover-foreground) / <alpha-value>)'
        },
        card: {
          DEFAULT: 'oklch(var(--card) / <alpha-value>)',
          foreground: 'oklch(var(--card-foreground) / <alpha-value>)'
        },
        "surface": "oklch(var(--card) / <alpha-value>)",
        "surface-dim": "oklch(var(--background) / <alpha-value>)",
        "surface-bright": "oklch(var(--popover) / <alpha-value>)",
        "surface-container-lowest": "oklch(var(--background) / <alpha-value>)",
        "surface-container-low": "oklch(var(--secondary) / <alpha-value>)",
        "surface-container": "oklch(var(--muted) / <alpha-value>)",
        "surface-container-high": "oklch(var(--border) / <alpha-value>)",
        "surface-container-highest": "oklch(var(--input) / <alpha-value>)",
        "on-surface": "oklch(var(--foreground) / <alpha-value>)",
        "on-surface-variant": "oklch(var(--muted-foreground) / <alpha-value>)",
        "outline": "oklch(var(--border) / <alpha-value>)",
        "outline-variant": "oklch(var(--input) / <alpha-value>)",
        "surface-tint": "oklch(var(--primary) / <alpha-value>)",
        "primary-container": "oklch(var(--accent) / <alpha-value>)",
        "on-primary-container": "oklch(var(--primary) / <alpha-value>)",
        "secondary-container": "oklch(var(--secondary) / <alpha-value>)",
        "on-secondary-container": "oklch(var(--foreground) / <alpha-value>)",
        "tertiary": "oklch(var(--ring) / <alpha-value>)",
        "on-tertiary": "oklch(var(--primary-foreground) / <alpha-value>)",
        "tertiary-container": "oklch(var(--accent) / <alpha-value>)",
        "on-tertiary-container": "oklch(var(--primary) / <alpha-value>)",
        "error": "oklch(var(--destructive) / <alpha-value>)",
        "on-error": "oklch(var(--destructive-foreground) / <alpha-value>)",
        "error-container": "oklch(var(--destructive) / <alpha-value>)",
        "on-error-container": "oklch(var(--destructive-foreground) / <alpha-value>)",
        soil: {
  				'50': '#fff8ed',
  				'100': '#f7ead5',
  				'300': '#d8b982',
  				'500': '#9b6c37',
  				'700': '#5e3b20',
  				'900': '#2b1a10'
  			},
  			leaf: {
  				'50': '#f2fbf1',
  				'100': '#ddf5d9',
  				'300': '#91d985',
  				'500': '#3d9f4b',
  				'700': '#287235',
  				'900': '#153d21',
  				'950': '#0d2614'
  			},
  			skyday: {
  				'50': '#eff9ff',
  				'100': '#dbf1ff',
  				'300': '#8ad4ff',
  				'500': '#2b9ee7',
  				'700': '#1773ad'
  			},
  			berry: {
  				'100': '#ffe5ee',
  				'300': '#ff9ebd',
  				'500': '#e74376',
  				'700': '#a31948'
  			},
  			gold: {
  				'100': '#fff4c7',
  				'300': '#f7d767',
  				'500': '#d99a1f',
  				'700': '#8b5d0b'
  			}
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)'
      },
      boxShadow: {
  			soft: '0 16px 40px rgba(34, 48, 32, 0.12)',
  			insetPlot: 'inset 0 2px 8px rgba(69, 44, 18, 0.22)'
  		},
      spacing: {
        "unit": "8px",
        "gutter": "24px",
        "margin-mobile": "16px",
        "margin-desktop": "48px",
        "stack-sm": "16px",
        "stack-md": "24px",
        "stack-lg": "48px",
        "container-max": "1280px"
      },
      fontFamily: {
        "headline-md": ["Outfit", "sans-serif"],
        "headline-lg-mobile": ["Outfit", "sans-serif"],
        "headline-lg": ["Outfit", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "display-lg": ["Outfit", "sans-serif"],
        "label-sm": ["JetBrains Mono", "monospace"],
        "label-md": ["JetBrains Mono", "monospace"],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      fontSize: {
        "headline-md": ["24px", {"lineHeight": "1.3", "fontWeight": "600"}],
        "headline-lg-mobile": ["32px", {"lineHeight": "1.2", "fontWeight": "600"}],
        "headline-lg": ["48px", {"lineHeight": "1.2", "letterSpacing": "-0.01em", "fontWeight": "600"}],
        "body-md": ["16px", {"lineHeight": "1.5", "fontWeight": "400"}],
        "body-lg": ["18px", {"lineHeight": "1.6", "fontWeight": "400"}],
        "display-lg": ["64px", {"lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "label-sm": ["12px", {"lineHeight": "1.4", "fontWeight": "500"}],
        "label-md": ["14px", {"lineHeight": "1.4", "letterSpacing": "0.02em", "fontWeight": "500"}]
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
