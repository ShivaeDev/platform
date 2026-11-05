import { expect } from "@effect/vitest";
import { manifestsExportsShape } from "#rules/manifestsExportsShape.ts";
import { exportsPackage, SOURCE_EXPORTS } from "#test/exportsPackage.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { exportsShapeMessage, exportsWorkspace, FILE_PATH_EXPORTS, LIBRARY_MANIFEST } from "#testing/adapters/packageExports.ts";

for (const file of ["package.json", LIBRARY_MANIFEST]) {
	for (const [name, exports] of [
		["source-only", SOURCE_EXPORTS],
		["source/types/dist", FILE_PATH_EXPORTS],
	] as const) {
		ruleStory.it(
			`manifests/exports-shape accepts private ${name} exports in ${file}`,
			[repositoryHas(exportsWorkspace, exportsPackage({ exports, private: true }, file))],
			function* ({ check }) {
				const findings = yield* check(manifestsExportsShape);

				expect(findings).toEqual([]);
			},
		);
	}

	for (const fields of [{}, { private: false }]) {
		ruleStory.it(
			`manifests/exports-shape rejects published source-only exports with private ${JSON.stringify(fields)} in ${file}`,
			[repositoryHas(exportsWorkspace, exportsPackage(fields, file))],
			function* ({ check }) {
				const findings = yield* check(manifestsExportsShape);

				expect(findings).toEqual([
					{ file, message: exportsShapeMessage('Export "./*.ts" does not preserve the module\'s file path.'), subject: "./*.ts" },
				]);
			},
		);
	}

	ruleStory.it(
		`manifests/exports-shape rejects private source-only test imports outside test-support in ${file}`,
		[repositoryHas(exportsWorkspace, exportsPackage({ imports: { "#*.ts": "./src/*.ts", "#test/*": "./test-support/*" }, private: true }, file))],
		function* ({ check }) {
			const findings = yield* check(manifestsExportsShape);

			expect(findings).toEqual([
				{
					file,
					message: 'Import "#test/*" must map to "./src/test-support/*". Keep test helpers under the source root’s test-support folder.',
					subject: "#test/*",
				},
			]);
		},
	);
}

const INVALID_PRIVATE_EXPORTS = [
	["a flattened source target", { "./*.ts": "./src/server/*.ts" }, "./*.ts", "does not preserve the module's file path"],
	["a module alias", { ...SOURCE_EXPORTS, "./server.ts": "./src/server/module.ts" }, "./server.ts", "does not preserve the module's file path"],
	["a second wildcard", { ...SOURCE_EXPORTS, "./server/*.ts": "./src/server/*.ts" }, "exports", "exactly one non-null wildcard"],
] as const;

for (const [name, exports, subject, reason] of INVALID_PRIVATE_EXPORTS) {
	ruleStory.it(
		`manifests/exports-shape rejects private ${name} and explains both accepted shapes`,
		[repositoryHas(exportsWorkspace, exportsPackage({ exports, private: true }, LIBRARY_MANIFEST))],
		function* ({ check }) {
			const findings = yield* check(manifestsExportsShape);

			expect(findings).toEqual([{ file: LIBRARY_MANIFEST, message: expect.stringContaining(reason), subject }]);
			expect(findings[0]?.message).toContain('source "./src/*.ts", types "./dist/*.d.ts" and default "./dist/*.js"');
			expect(findings[0]?.message).toContain('For a private package, mapping "./*.ts" directly to "./src/*.ts" is also accepted.');
		},
	);
}
