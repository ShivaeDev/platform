import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { adapterServiceFiles } from "#test/adapterServiceFiles.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

ruleStory.it(
	"service parameters accepts foreign object methods beside a local interface method taking the same service",
	[
		effectResolves(),
		repositoryHas(
			...adapterServiceFiles.slice(0, 3).map((file) => ({
				...file,
				content: file.path.endsWith("index.d.ts")
					? `${file.content}\nexport interface Plugin { configureServer?(server: ViteDevServer): void; }`
					: file.content,
			})),
			{
				content: `import type { Plugin, ViteDevServer } from "vite";
export const plugin: Plugin = { configureServer(server) { void server.close(); } };
interface Local { configureServer(server: ViteDevServer): void; }
export const local: Local = { configureServer(server) { void server.close(); } };`,
				path: "src/adapters/plugin.ts",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceParameters);

		expect(findings).toEqual([
			expect.objectContaining({ file: "src/adapters/plugin.ts", line: 3 }),
			expect.objectContaining({ file: "src/adapters/plugin.ts", line: 4 }),
		]);
	},
);
