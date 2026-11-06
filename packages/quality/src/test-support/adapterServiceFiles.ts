export const adapterServiceFiles = [
	{
		content: `import { Context } from "effect";
import type { ViteDevServer } from "vite";
export class RendererServer extends Context.Service<RendererServer, ViteDevServer>()("app/RendererServer") {}`,
		path: "src/RendererServer.ts",
	},
	{
		content: '{"name":"vite","types":"index.d.ts"}',
		path: "node_modules/vite/package.json",
	},
	{
		content: `export interface ViteDevServer { readonly close: () => Promise<void>; readonly config: { readonly root: string }; }
export declare function createServer(): Promise<ViteDevServer>;`,
		path: "node_modules/vite/index.d.ts",
	},
	{
		content: `import { Effect } from "effect";
import { createServer, type ViteDevServer } from "vite";
export function close(server: ViteDevServer) { return Effect.promise(() => server.close()); }
export const renderer = Effect.gen(function* () {
 const server = yield* Effect.promise(() => createServer());
 yield* close(server);
});`,
		path: "apps/desktop/script/adapters/renderer-tooling.ts",
	},
];
