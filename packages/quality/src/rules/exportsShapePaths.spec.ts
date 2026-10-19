import { expect } from "vitest";
import { exportsStory, filePathExports, standaloneWithExports, workspaceWithExports } from "#exports-story";
import { CLI_EXIT } from "#test/cli.ts";

exportsStory.it(
	"a named alias directs the author to import the module at its file path through the wildcard",
	[
		workspaceWithExports({
			...filePathExports,
			"./better-auth.ts": {
				default: "./dist/server/better-auth/mount.js",
				source: "./src/server/better-auth/mount.ts",
				types: "./dist/server/better-auth/mount.d.ts",
			},
		}),
	],
	function* ({ lint }) {
		const result = yield* lint();
		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stdout).toContain("manifests/exports-shape");
		expect(result.stdout).toContain('Export "./better-auth.ts"');
		expect(result.stdout).toContain("Import the module at its file path through the single");
		expect(result.stdout).toContain("./server/better-auth/mount.ts");
	},
);

exportsStory.it(
	"a second non-null wildcard fails even when both patterns preserve paths",
	[
		workspaceWithExports({
			...filePathExports,
			"./server/*.ts": { default: "./dist/server/*.js", source: "./src/server/*.ts", types: "./dist/server/*.d.ts" },
		}),
	],
	function* ({ lint }) {
		const result = yield* lint();
		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stdout).toContain("exactly one non-null wildcard; found 2");
	},
);

exportsStory.it(
	"null entries block exact and wildcard paths without adding public exports",
	[workspaceWithExports({ ...filePathExports, "./internal/*": "./src/internal/*", "./private.ts": "./src/private.ts" })],
	function* ({ lint, writesExports }) {
		expect((yield* lint()).stdout).toContain("manifests/exports-shape");
		yield* writesExports({ ...filePathExports, "./internal/*": null, "./private.ts": null });
		expect((yield* lint()).status).toBe(CLI_EXIT.passed);
	},
);

exportsStory.it(
	"the standard shape and an optional root replace flattened paths",
	[workspaceWithExports({ "./*.ts": { default: "./dist/server/*.js", source: "./src/server/*.ts", types: "./dist/server/*.d.ts" } })],
	function* ({ lint, writesExports }) {
		expect((yield* lint()).stdout).toContain('Export "./*.ts"');
		yield* writesExports({ ".": "./dist/index.js", ...filePathExports });
		expect((yield* lint()).status).toBe(CLI_EXIT.passed);
		yield* writesExports({ "./server/*.ts": { default: "./dist/server/*.js", source: "./src/server/*.ts", types: "./dist/server/*.d.ts" } });
		expect((yield* lint()).status).toBe(CLI_EXIT.passed);
	},
);

exportsStory.it(
	"exact non-code asset paths replace JSON preset aliases",
	[workspaceWithExports({ ...filePathExports, "./biome": "./biome/preset.json" })],
	function* ({ lint, writesExports }) {
		expect((yield* lint()).stdout).toContain('Export "./biome"');
		yield* writesExports({ ...filePathExports, "./biome/preset.json": "./biome/preset.json", "./tsconfig/base.json": "./tsconfig/base.json" });
		expect((yield* lint()).status).toBe(CLI_EXIT.passed);
	},
);

exportsStory.it(
	"the standalone package follows the same policy as workspace members",
	[standaloneWithExports({ ...filePathExports, "./alias.ts": "./src/server/module.ts" })],
	function* ({ lint, writesExports }) {
		expect((yield* lint()).stdout).toContain('Export "./alias.ts"');
		yield* writesExports(filePathExports, "package.json");
		expect((yield* lint()).status).toBe(CLI_EXIT.passed);
	},
);

exportsStory.it("a source tree can be checked without a package manifest", [], function* ({ lint, writesExports }) {
	expect((yield* lint()).status).toBe(CLI_EXIT.passed);
	yield* writesExports({ "./client.ts": { default: "./dist/client.js", source: "./src/client.ts", types: "./dist/client.d.ts" } }, "package.json");
	const listed = yield* lint();
	expect(listed.status).toBe(CLI_EXIT.rejected);
	expect(listed.stdout).toContain("exactly one non-null wildcard; found 0");
	expect(listed.stdout).toContain('Export "./client.ts"');
});
