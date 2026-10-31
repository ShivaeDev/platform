import { expect } from "vitest";
import { manifestsExportsShape } from "#rules/manifestsExportsShape.ts";
import { exportsShapeMessage, exportsWorkspace, FILE_PATH_EXPORTS, LIBRARY_MANIFEST, packageExports } from "#test/packageExports.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const SERVER_WILDCARD = { "./server/*.ts": { default: "./dist/server/*.js", source: "./src/server/*.ts", types: "./dist/server/*.d.ts" } };

const CLIENT_MODULE = { "./client.ts": { default: "./dist/client.js", source: "./src/client.ts", types: "./dist/client.d.ts" } };

const ACCEPTED_EXPORTS = [
	{ exports: { ".": "./dist/index.js", ...FILE_PATH_EXPORTS }, name: "an optional root export beside the wildcard" },
	{ exports: SERVER_WILDCARD, name: "a single wildcard under a subpath that keeps the module's path" },
	{
		exports: { ...FILE_PATH_EXPORTS, "./biome/preset.json": "./biome/preset.json", "./tsconfig/base.json": "./tsconfig/base.json" },
		name: "non-code assets at their exact paths beside the wildcard",
	},
	{ exports: { "./package.json": "./package.json" }, name: "a package without modules that exports only its exact assets" },
];

for (const path of ["./private.ts", "./internal/*", ".", "./preset.json"]) {
	ruleStory.it(
		`manifests/exports-shape asks to remove a null export at ${path} until it is removed`,
		[repositoryHas(exportsWorkspace, packageExports({ ...FILE_PATH_EXPORTS, [path]: null }))],
		function* ({ check, writes }) {
			expect(yield* check(manifestsExportsShape)).toEqual([
				{
					file: LIBRARY_MANIFEST,
					message: exportsShapeMessage(`Export "${path}" blocks module imports with null. Remove the null entry so callers can import each module.`),
					subject: path,
				},
			]);

			yield* writes(packageExports(FILE_PATH_EXPORTS));

			expect(yield* check(manifestsExportsShape)).toEqual([]);
		},
	);
}

for (const { exports, name } of ACCEPTED_EXPORTS) {
	ruleStory.it(`manifests/exports-shape accepts ${name}`, [repositoryHas(exportsWorkspace, packageExports(exports))], function* ({ check }) {
		expect(yield* check(manifestsExportsShape)).toEqual([]);
	});
}

ruleStory.it(
	"manifests/exports-shape reports a second non-null wildcard even when both keep the module's path",
	[repositoryHas(exportsWorkspace, packageExports({ ...FILE_PATH_EXPORTS, ...SERVER_WILDCARD }))],
	function* ({ check }) {
		const findings = yield* check(manifestsExportsShape);

		expect(findings).toEqual([
			{ file: LIBRARY_MANIFEST, message: exportsShapeMessage("The exports field needs exactly one non-null wildcard; found 2."), subject: "exports" },
		]);
	},
);

ruleStory.it(
	"manifests/exports-shape reports a root export without the wildcard as a missing wildcard",
	[repositoryHas(exportsWorkspace, packageExports({ ".": "./dist/index.js", "./package.json": "./package.json" }))],
	function* ({ check }) {
		const findings = yield* check(manifestsExportsShape);

		expect(findings).toEqual([
			{ file: LIBRARY_MANIFEST, message: exportsShapeMessage("The exports field needs exactly one non-null wildcard; found 0."), subject: "exports" },
		]);
	},
);

ruleStory.it(
	"manifests/exports-shape checks a standalone package's own manifest like a workspace member's",
	[repositoryHas(packageExports({ ...FILE_PATH_EXPORTS, "./alias.ts": "./src/server/module.ts" }, "package.json"))],
	function* ({ check }) {
		const findings = yield* check(manifestsExportsShape);

		expect(findings).toEqual([
			{ file: "package.json", message: exportsShapeMessage('Export "./alias.ts" does not preserve the module\'s file path.'), subject: "./alias.ts" },
		]);
	},
);

ruleStory.it(
	"manifests/exports-shape reports a per-file module export without the wildcard as a missing wildcard and an unpreserved path",
	[repositoryHas(packageExports(CLIENT_MODULE, "package.json"))],
	function* ({ check }) {
		const findings = yield* check(manifestsExportsShape);

		expect(findings).toEqual([
			{ file: "package.json", message: exportsShapeMessage("The exports field needs exactly one non-null wildcard; found 0."), subject: "exports" },
			{
				file: "package.json",
				message: exportsShapeMessage('Export "./client.ts" does not preserve the module\'s file path.'),
				subject: "./client.ts",
			},
		]);
	},
);
