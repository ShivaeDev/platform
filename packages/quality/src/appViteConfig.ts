import { vitePort } from "#adapters/vitePort.ts";

export function appViteConfig<TPlugin>(
	plugins: TPlugin[],
	conditions: string[] = [],
	proxyPaths: string[] = [],
	{ webPort = vitePort("VITE_PORT", 5173), apiPort = vitePort("PORT", 3000) }: { webPort?: number; apiPort?: number } = {},
) {
	return {
		plugins,
		resolve: { conditions, tsconfigPaths: true },
		server: {
			host: "127.0.0.1",
			port: webPort,
			proxy: Object.fromEntries(
				["/api/auth", "/rpc", ...proxyPaths].map((path) => [
					path,
					{ changeOrigin: false, target: `http://127.0.0.1:${apiPort}`, ws: path === "/rpc" },
				]),
			),
			strictPort: true,
		},
	};
}
