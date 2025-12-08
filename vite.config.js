import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['icon.png', 'icons/logo.svg', 'sw-custom.js'],
			devOptions: {
				enabled: true, // Enable SW in development
				type: 'module',
				navigateFallback: 'index.html',
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
				importScripts: ['/sw-custom.js'],
				// Skip waiting and claim clients immediately
				skipWaiting: true,
				clientsClaim: true,
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/kuftyqupibyjliaukpxn\.supabase\.co\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'supabase-api-cache',
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 5, // 5 minutos para datos dinámicos
							},
							cacheableResponse: {
								statuses: [200], // Solo cachear respuestas exitosas (no status 0 = CORS error)
							},
							networkTimeoutSeconds: 10, // Timeout antes de usar cache
						},
					},
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365,
							},
							cacheableResponse: {
								statuses: [200],
							},
						},
					},
					{
						urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
						handler: 'CacheFirst',
						options: {
							cacheName: 'images-cache',
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 60 * 60 * 24 * 30,
							},
						},
					},
				],
			},
			manifest: {
				name: 'Manny Rewards - Programa de Lealtad',
				short_name: 'Manny Rewards',
				description: 'Acumula puntos, canjea recompensas y disfruta beneficios exclusivos en Manny',
				theme_color: '#e91e63',
				background_color: '#ffffff',
				display: 'standalone',
				orientation: 'portrait',
				scope: '/',
				start_url: '/',
				lang: 'es-MX',
				categories: ['lifestyle', 'shopping', 'business'],
				icons: [
					{
						src: '/icon.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: '/icon.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				],
				shortcuts: [
					{
						name: 'Ver mis puntos',
						short_name: 'Puntos',
						description: 'Consulta tu saldo de puntos actual',
						url: '/dashboard',
						icons: [{ src: '/icon.png', sizes: '512x512', type: 'image/png' }]
					},
					{
						name: 'Canjear recompensa',
						short_name: 'Canjear',
						description: 'Canjea tus puntos por productos',
						url: '/recompensas',
						icons: [{ src: '/icon.png', sizes: '512x512', type: 'image/png' }]
					}
				]
			}
		})
	],
	server: {
		cors: true,
		headers: {
			'Cross-Origin-Embedder-Policy': 'credentialless',
		},
		allowedHosts: true,
	},
	resolve: {
		extensions: ['.jsx', '.js', '.tsx', '.ts', '.json', ],
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	build: {
		rollupOptions: {
			external: [
				'@babel/parser',
				'@babel/traverse',
				'@babel/generator',
				'@babel/types'
			],
			output: {
				manualChunks: {
					// Core React - loaded on every page
					'vendor-react': ['react', 'react-dom', 'react-router-dom'],
					// UI framework - loaded on every page
					'vendor-ui': ['framer-motion', '@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-toast', '@radix-ui/react-dropdown-menu'],
					// Charts - only used in Admin dashboard
					'vendor-charts': ['recharts'],
					// Data fetching
					'vendor-query': ['@tanstack/react-query'],
					// Supabase
					'vendor-supabase': ['@supabase/supabase-js'],
				}
			}
		}
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: './src/test/setup.js',
		css: false,
	}
});
