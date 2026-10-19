import { expect } from "vitest";
import { filePathExports, packageExports, workspaceWithExports } from "#quality/test-support/exportsRepository.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";

ruleKit.it(
	"a standalone package's root exports follow the same policy as workspace members",
	[repositoryHas(packageExports({ ...filePathExports, "./alias.ts": "./src/server/module.ts" }, "package.json"))],
	function* ({ checksDefault, writes }) {
		const findings = yield* checksDefault("manifests/exports-shape");
		expect(findings.map((finding) => [finding.file, finding.subject])).toEqual([["package.json", "./alias.ts"]]);
		yield* writes(packageExports(filePathExports, "package.json"));
		expect(yield* checksDefault("manifests/exports-shape")).toEqual([]);
	},
);

ruleKit.it(
	"a named alias directs the author to the module's file path",
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
	function* ({ checksDefault }) {
		const findings = yield* checksDefault("manifests/exports-shape");
		expect(findings.map((finding) => finding.subject)).toEqual(["./better-auth.ts"]);
		expect(findings[0]?.message).toContain("Import the module at its file path through the single");
		expect(findings[0]?.message).toContain("./server/better-auth/mount.ts");
	},
);

ruleKit.it(
	"a second non-null wildcard fails even when the standard wildcard exists",
	[
		workspaceWithExports({
			...filePathExports,
			"./server/*.ts": { default: "./dist/server/*.js", source: "./src/server/*.ts", types: "./dist/server/*.d.ts" },
		}),
	],
	function* ({ checksDefault }) {
		const findings = yield* checksDefault("manifests/exports-shape");
		expect(findings.map((finding) => finding.subject)).toEqual(["exports"]);
		expect(findings[0]?.message).toContain("exactly one non-null wildcard; found 2");
	},
);

ruleKit.it(
	"null entries block exact paths and wildcard paths without adding public aliases",
	[workspaceWithExports({ ...filePathExports, "./internal/*": "./src/internal/*", "./private.ts": "./src/private.ts" })],
	function* ({ checksDefault, writes }) {
		const publicPaths = yield* checksDefault("manifests/exports-shape");
		expect(publicPaths.map((finding) => finding.subject)).toEqual(["exports", "./internal/*", "./private.ts"]);
		yield* writes(packageExports({ ...filePathExports, "./internal/*": null, "./private.ts": null }));
		expect(yield* checksDefault("manifests/exports-shape")).toEqual([]);
	},
);

ruleKit.it(
	"the standard wildcard preserves paths instead of flattening a server folder",
	[workspaceWithExports({ "./*.ts": { default: "./dist/server/*.js", source: "./src/server/*.ts", types: "./dist/server/*.d.ts" } })],
	function* ({ checksDefault, writes }) {
		const flattened = yield* checksDefault("manifests/exports-shape");
		expect(flattened.map((finding) => finding.subject)).toEqual(["./*.ts"]);
		yield* writes(packageExports({ ".": "./dist/index.js", ...filePathExports }));
		expect(yield* checksDefault("manifests/exports-shape")).toEqual([]);
		yield* writes(packageExports({ "./server/*.ts": { default: "./dist/server/*.js", source: "./src/server/*.ts", types: "./dist/server/*.d.ts" } }));
		expect(yield* checksDefault("manifests/exports-shape")).toEqual([]);
	},
);

ruleKit.it(
	"a per-file list is replaced by the file-path wildcard",
	[workspaceWithExports({ "./client.ts": { default: "./dist/client.js", source: "./src/client.ts", types: "./dist/client.d.ts" } })],
	function* ({ checksDefault, writes }) {
		const listed = yield* checksDefault("manifests/exports-shape");
		expect(listed.map((finding) => finding.subject)).toEqual(["exports", "./client.ts"]);
		yield* writes(packageExports(filePathExports));
		expect(yield* checksDefault("manifests/exports-shape")).toEqual([]);
	},
);

ruleKit.it(
	"the wildcard's source, declaration and runtime targets all preserve the path",
	[workspaceWithExports({ "./*.ts": { default: "./dist/server/*.js", source: "./src/*.ts", types: "./dist/server/*.d.ts" } })],
	function* ({ checksDefault, writes }) {
		expect((yield* checksDefault("manifests/exports-shape")).map((finding) => finding.subject)).toEqual(["./*.ts"]);
		yield* writes(packageExports(filePathExports));
		expect(yield* checksDefault("manifests/exports-shape")).toEqual([]);
	},
);

ruleKit.it(
	"JSON presets use their exact file paths rather than aliases",
	[workspaceWithExports({ ...filePathExports, "./biome": "./biome/preset.json" })],
	function* ({ checksDefault, writes }) {
		const findings = yield* checksDefault("manifests/exports-shape");
		expect(findings.map((finding) => finding.subject)).toEqual(["./biome"]);
		expect(findings[0]?.message).toContain("Non-code assets must use their exact file paths.");
		yield* writes(
			packageExports({ ...filePathExports, "./biome/preset.json": "./biome/preset.json", "./tsconfig/base.json": "./tsconfig/base.json" }),
		);
		expect(yield* checksDefault("manifests/exports-shape")).toEqual([]);
	},
);
