import { expect } from "vitest";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { importStory, repositoryHas } from "#test/importStory.ts";

for (const path of ["src/server/host.ts", "src/client/host.ts", "src/host.ts"]) {
	importStory.it(
		`imports/runtime reports the Node platform barrel in ${path} with the imported module's subpath`,
		[repositoryHas({ content: 'import { NodeHttpServer as HttpServer } from "@effect/platform-node";', path })],
		function* ({ check }) {
			const findings = yield* check(importsRuntime);

			expect(findings).toEqual([
				{
					file: path,
					line: 1,
					message:
						'The @effect/platform-node barrel loads optional integrations such as redis. Import module subpaths instead: `import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"`.',
					subject: "@effect/platform-node",
				},
			]);
		},
	);
}

for (const content of [
	'import * as Node from "@effect/platform-node";',
	'import "@effect/platform-node";',
	'export { NodeServices } from "@effect/platform-node";',
	'const load = () => import("@effect/platform-node");',
	'const Node = require("@effect/platform-node");',
]) {
	importStory.it(
		`imports/runtime reports a Node platform barrel loaded by ${content}`,
		[repositoryHas({ content, path: "src/server/host.ts" })],
		function* ({ check, messages }) {
			yield* check(importsRuntime);

			expect(yield* messages()).toEqual([expect.stringContaining("@effect/platform-node/NodeServices")]);
		},
	);
}

importStory.it(
	"imports/runtime accepts Node platform subpaths, type-only imports and test support",
	[
		repositoryHas(
			{
				content:
					'import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";\nimport type { NodeServices } from "@effect/platform-node";\nimport { type NodeRuntime } from "@effect/platform-node";\nexport { type NodeFileSystem } from "@effect/platform-node";',
				path: "src/server/host.ts",
			},
			{ content: 'import { NodeServices } from "@effect/platform-node";', path: "src/test-support/host.ts" },
			{ content: 'import { NodeServices } from "@effect/platform-node";', path: "src/server/host.d.ts" },
		),
	],
	function* ({ check }) {
		expect(yield* check(importsRuntime)).toEqual([]);
	},
);
