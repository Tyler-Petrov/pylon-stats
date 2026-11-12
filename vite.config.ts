import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	// `pnpm dev` prints this machine's Tailscale URLs, so listen on every interface and answer the
	// tailnet's hostname (`tailscale serve` passes it through).
	server: { host: true, allowedHosts: ['.ts.net'] },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
				experimental: { async: true }
			},
			adapter: adapter(),
			experimental: { remoteFunctions: true },
			// Open pages check for a new release, and the root layout moves them onto it.
			version: { pollInterval: 5 * 60 * 1000 }
		})
	]
});
