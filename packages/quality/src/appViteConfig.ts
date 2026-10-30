export function appViteConfig<TPlugin>(plugins: TPlugin[], conditions: string[] = [], proxyPaths: string[] = []) {
	return {
		plugins,
		resolve: { conditions, tsconfigPaths: true },
		server: {
			host: "127.0.0.1",
			port: 5173,
			proxy: Object.fromEntries(["/api/auth", "/rpc", ...proxyPaths].map((path) => [path, { changeOrigin: false, target: "http://127.0.0.1:3000" }])),
			strictPort: true,
		},
	};
}
