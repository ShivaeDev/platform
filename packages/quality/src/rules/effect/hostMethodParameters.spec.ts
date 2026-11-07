import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { adapterServiceFiles } from "#test/adapterServiceFiles.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

ruleStory.it(
	"service parameters accepts inline Vite plugin callbacks beside local methods taking the same service",
	[
		effectResolves(),
		repositoryHas(
			...adapterServiceFiles.slice(0, 3).map((file) => ({
				...file,
				content: file.path.endsWith("index.d.ts")
					? `${file.content}\ntype ObjectHook<T> = T | { handler: T; order?: "pre" | "post" | null };\nexport type ServerHook = (server: ViteDevServer) => void;\nexport interface Plugin { readonly name: string; configureServer?: ObjectHook<ServerHook>; }\nexport type PluginOption = Plugin | readonly PluginOption[] | Promise<PluginOption> | false | null | undefined;\nexport interface InlineConfig { readonly plugins?: PluginOption[]; }\nexport declare function createServer(config?: InlineConfig): Promise<ViteDevServer>;`
					: file.content,
			})),
			{
				content: `import { createServer, type Plugin, type ViteDevServer } from "vite";
export const plugin: Plugin = { name: "declared", configureServer(server) { void server.close(); } };
void createServer({ plugins: [{ name: "inline", configureServer(server) { void server.close(); } }] });
interface Local { configureServer(server: ViteDevServer): void; }
export const local: Local = { configureServer(server) { void server.close(); } };`,
				path: "src/adapters/plugin.ts",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceParameters);

		expect(findings).toEqual([
			expect.objectContaining({ file: "src/adapters/plugin.ts", line: 4 }),
			expect.objectContaining({ file: "src/adapters/plugin.ts", line: 5 }),
		]);
	},
);
