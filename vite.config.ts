import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// SPA: no server; the fallback page handles client-side routing.
			adapter: adapter({ fallback: '404.html' }),
			// GitHub Pages serves the app under /ark-ground in production.
			paths: { base: process.env.NODE_ENV === 'production' ? '/ark-ground' : '' }
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				// Node tests that import the registry pull in `.svelte` node components,
				// which import `@xyflow/svelte` (TS `.svelte` source the Svelte compiler
				// mis-strips under rolldown, breaking the suite). These tests never render
				// components, so alias the library to a harmless stub.
				resolve: {
					alias: {
						'@xyflow/svelte': fileURLToPath(
							new URL('./src/lib/test/xyflow-stub.ts', import.meta.url)
						)
					}
				},
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
