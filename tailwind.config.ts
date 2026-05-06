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
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
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
  				'900': '#153d21'
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
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			soft: '0 16px 40px rgba(34, 48, 32, 0.12)',
  			insetPlot: 'inset 0 2px 8px rgba(69, 44, 18, 0.22)'
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-sans)',
  				'ui-sans-serif',
  				'system-ui'
  			],
  			mono: [
  				'var(--font-mono)',
  				'ui-monospace',
  				'SFMono-Regular',
  				'monospace'
  			]
  		}
  	}
  },
  plugins: [tailwindcssAnimate]
};

export default config;
