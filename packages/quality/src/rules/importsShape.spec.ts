import { expect } from "@effect/vitest";
import { manifestsExportsShape } from "#rules/manifestsExportsShape.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { exportsWorkspace, LIBRARY_MANIFEST, packageImports } from "#testing/adapters/packageExports.ts";

const ROOT_TARGETS = { "@shivaedev/source": "./src/*.ts", default: "./dist/*.js", types: "./dist/*.d.ts" };

const ACCEPTED_IMPORTS = [
	{ imports: { "#*.ts": ROOT_TARGETS, "#test/*": "./src/test-support/*" }, name: "conditional source-rooted imports and test-support imports" },
	{ imports: { "#*.ts": "./src/*.ts" }, name: "a direct source-rooted import without a test alias" },
	{
		imports: { "#*.ts": ROOT_TARGETS, "#client/*.tsx": "./src/client/*.tsx", "#package.json": "./package.json", "#test/*": "./src/test-support/*" },
		name: "other aliases beside the two standard imports",
	},
	{ imports: { "#package.json": "./package.json" }, name: "other aliases without either standard import" },
];

const REJECTED_IMPORTS = [
	{ key: "#*.ts", name: "a direct server-rooted target", value: "./src/server/*.ts" },
	{ key: "#*.ts", name: "a server-rooted source condition", value: { ...ROOT_TARGETS, "@shivaedev/source": "./src/server/*.ts" } },
	{ key: "#*.ts", name: "a server-rooted types condition", value: { ...ROOT_TARGETS, types: "./dist/server/*.d.ts" } },
	{ key: "#*.ts", name: "a server-rooted runtime condition", value: { ...ROOT_TARGETS, default: "./dist/server/*.js" } },
	{ key: "#*.ts", name: "a missing types condition", value: { "@shivaedev/source": "./src/*.ts", default: "./dist/*.js" } },
	{ key: "#*.ts", name: "an extra condition", value: { ...ROOT_TARGETS, node: "./dist/server/*.js" } },
	{ key: "#test/*", name: "test support outside src", value: "./test-support/*" },
] as const;

for (const file of [LIBRARY_MANIFEST, "package.json"]) {
	for (const { imports, name } of ACCEPTED_IMPORTS) {
		ruleStory.it(
			`manifests/exports-shape accepts ${name} in ${file}`,
			[repositoryHas(exportsWorkspace, packageImports(imports, file))],
			function* ({ check }) {
				expect(yield* check(manifestsExportsShape)).toEqual([]);
			},
		);
	}

	for (const { key, name, value } of REJECTED_IMPORTS) {
		ruleStory.it(
			`manifests/exports-shape reports ${name} in ${file} until the standard import is rooted correctly`,
			[repositoryHas(exportsWorkspace, packageImports({ [key]: value }, file))],
			function* ({ check, writes }) {
				const message =
					key === "#*.ts"
						? 'Import "#*.ts" must preserve the path from the source root. Map it to "./src/*.ts", or to source "./src/*.ts", types "./dist/*.d.ts" and default "./dist/*.js". Include subfolders in import specifiers, for example "#server/module.ts".'
						: 'Import "#test/*" must map to "./src/test-support/*". Keep test helpers under the source root’s test-support folder.';
				expect(yield* check(manifestsExportsShape)).toEqual([
					{
						file,
						message,
						subject: key,
					},
				]);

				yield* writes(packageImports({ [key]: key === "#*.ts" ? ROOT_TARGETS : "./src/test-support/*" }, file));

				expect(yield* check(manifestsExportsShape)).toEqual([]);
			},
		);
	}
}
