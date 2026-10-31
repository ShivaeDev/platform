import { expect } from "vitest";
import { manifestsExportsShape } from "#rules/manifestsExportsShape.ts";
import { exportsShapeMessage, exportsWorkspace, FILE_PATH_EXPORTS, LIBRARY_MANIFEST, packageExports } from "#test/packageExports.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const NOT_SUBPATH_MAPS = [
	["a string target", "./dist/index.js"],
	["an array of targets", ["./dist/index.js"]],
	["a null exports field", null],
] as const;

const UNPRESERVED_WILDCARDS = [
	["a key without a relative prefix", "*.ts", { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" }],
	["a non-TypeScript wildcard", "./*.js", { default: "./dist/*.js", source: "./src/*.js", types: "./dist/*.d.ts" }],
	["multiple stars in one pattern", "./**/*.ts", { default: "./dist/**/*.js", source: "./src/**/*.ts", types: "./dist/**/*.d.ts" }],
	["a wildcard without conditions", "./*.ts", "./src/*.ts"],
	["an extra condition", "./*.ts", { default: "./dist/*.js", node: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" }],
	["a missing condition", "./*.ts", { default: "./dist/*.js", source: "./src/*.ts" }],
	["a flattened source target", "./*.ts", { default: "./dist/*.js", source: "./src/server/*.ts", types: "./dist/*.d.ts" }],
	["a flattened declaration target", "./*.ts", { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/server/*.d.ts" }],
	["a flattened runtime target", "./*.ts", { default: "./dist/server/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" }],
] as const;

const UNPRESERVED_ENTRIES = [
	["an asset alias", "./preset.json", "./biome/preset.json"],
	["an extensionless alias of a JSON asset", "./biome", "./biome/preset.json"],
	["an extensionless per-file entry", "./license", "./license"],
	["a code file exposed as an asset", "./module.js", "./module.js"],
	[
		"a named alias of a module",
		"./better-auth.ts",
		{ default: "./dist/server/better-auth/mount.js", source: "./src/server/better-auth/mount.ts", types: "./dist/server/better-auth/mount.d.ts" },
	],
] as const;

ruleStory.it(
	"manifests/exports-shape accepts the file-preserving wildcard beside the exact package.json asset",
	[repositoryHas(exportsWorkspace, packageExports(FILE_PATH_EXPORTS))],
	function* ({ check }) {
		expect(yield* check(manifestsExportsShape)).toEqual([]);
	},
);

for (const [name, exports] of NOT_SUBPATH_MAPS) {
	ruleStory.it(
		`manifests/exports-shape reports ${name} instead of a subpath map`,
		[repositoryHas(exportsWorkspace, packageExports(exports))],
		function* ({ check }) {
			const findings = yield* check(manifestsExportsShape);

			expect(findings).toEqual([
				{ file: LIBRARY_MANIFEST, message: exportsShapeMessage("The exports field must be a subpath map."), subject: "exports" },
			]);
		},
	);
}

for (const [name, key, value] of UNPRESERVED_WILDCARDS) {
	ruleStory.it(
		`manifests/exports-shape reports ${name} as not preserving the module's file path`,
		[repositoryHas(exportsWorkspace, packageExports({ [key]: value }))],
		function* ({ check }) {
			const findings = yield* check(manifestsExportsShape);

			expect(findings).toEqual([
				{ file: LIBRARY_MANIFEST, message: exportsShapeMessage(`Export "${key}" does not preserve the module's file path.`), subject: key },
			]);
		},
	);
}

for (const [name, key, value] of UNPRESERVED_ENTRIES) {
	ruleStory.it(
		`manifests/exports-shape reports ${name} beside the wildcard as not preserving the module's file path`,
		[repositoryHas(exportsWorkspace, packageExports({ ...FILE_PATH_EXPORTS, [key]: value }))],
		function* ({ check }) {
			const findings = yield* check(manifestsExportsShape);

			expect(findings).toEqual([
				{ file: LIBRARY_MANIFEST, message: exportsShapeMessage(`Export "${key}" does not preserve the module's file path.`), subject: key },
			]);
		},
	);
}
