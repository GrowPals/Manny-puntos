/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{js,jsx}',
		'./components/**/*.{js,jsx}',
		'./app/**/*.{js,jsx}',
		'./src/**/*.{js,jsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				// Extend Tailwind's color palette with Manny's custom colors
				primary: {
					DEFAULT: 'var(--color-primary)',
					vibrant: 'var(--color-primary-vibrant)',
					dark: 'var(--color-primary-dark)',
					darker: 'var(--color-primary-darker)',
					foreground: 'hsl(var(--primary-foreground))', // For shadcn/ui
				},
				secondary: {
					DEFAULT: 'var(--color-secondary)',
					light: 'var(--color-secondary-light)',
					dark: 'var(--color-secondary-dark)', // This was the missing part!
					foreground: 'hsl(var(--secondary-foreground))', // For shadcn/ui
				},
				accent: {
					DEFAULT: 'var(--color-accent)',
					foreground: 'hsl(var(--accent-foreground))',
				},
				whatsapp: 'var(--color-whatsapp)', // Direct color for WhatsApp

				// Existing shadcn/ui specific colors
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
			},
			borderRadius: {
				lg: 'var(--radius-lg)',
				xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: 0 },
				},
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px var(--color-primary-vibrant), 0 0 10px var(--color-primary-vibrant)' },
          '50%': { boxShadow: '0 0 15px var(--color-primary-vibrant), 0 0 25px var(--color-primary-vibrant)' },
        },
        rotate: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        }
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
        'glow': 'glow 2.5s ease-in-out infinite',
        'rotate': 'rotate 20s linear infinite',
			},
			fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['monospace'],
      },
      fontWeight: {
        'thin': 100,
        'extralight': 200,
        'light': 300,
        'normal': 400,
        'medium': 500,
        'semibold': 600,
        'bold': 700,
        'extrabold': 800,
        'black': 900,
      }
		},
	},
	plugins: [require('tailwindcss-animate')],
};