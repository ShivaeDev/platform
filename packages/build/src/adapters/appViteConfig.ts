import type { PluginOption } from "vite";
import { type BuildPluginOptions, buildPlugin } from "#adapters/vitePlugin.ts";
import { vitePort } from "#adapters/vitePort.ts";

export interface AppViteOptions extends BuildPluginOptions {
	readonly apiPort?: number;
	readonly webPort?: number;
}

export function appViteConfig(
	plugins: PluginOption[],
	conditions: string[] = [],
	proxyPaths: string[] = [],
	{ webPort = vitePort("VITE_PORT", 5173), apiPort = vitePort("PORT", 3000), ...build }: AppViteOptions = {},
) {
	return {
		plugins: [...plugins, ...buildPlugin(build)],
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
