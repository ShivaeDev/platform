import { expect } from "@effect/vitest";
import { manifestsExportsShape } from "#rules/manifestsExportsShape.ts";
import { exportsPackage } from "#test/exportsPackage.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { exportsWorkspace, FILE_PATH_EXPORTS, LIBRARY_MANIFEST } from "#testing/adapters/packageExports.ts";

for (const file of ["package.json", LIBRARY_MANIFEST]) {
	for (const target of ["./test/*", "./tests/*", "./test-support/*", "./test/support/*", "./src/test-support/*"]) {
		ruleStory.it(
			`manifests/exports-shape accepts private #test/* at ${target} in ${file}`,
			[repositoryHas(exportsWorkspace, exportsPackage({ imports: { "#test/*": target }, private: true }, file))],
			function* ({ check }) {
				const findings = yield* check(manifestsExportsShape);

				expect(findings).toEqual([]);
			},
		);
	}
}

for (const target of ["../other/test/*", "./test/../../other/test/*", "./src/other/*", "./fixtures/*"]) {
	ruleStory.it(
		`manifests/exports-shape rejects private #test/* outside its test tree at ${target}`,
		[repositoryHas(exportsWorkspace, exportsPackage({ imports: { "#test/*": target }, private: true }, LIBRARY_MANIFEST))],
		function* ({ check }) {
			const findings = yield* check(manifestsExportsShape);

			expect(findings).toEqual([{ file: LIBRARY_MANIFEST, message: expect.stringContaining('Import "#test/*" must map'), subject: "#test/*" }]);
		},
	);
}

for (const fields of [
	{ exports: { "./*": "./src/*" }, imports: {} },
	{ exports: FILE_PATH_EXPORTS, imports: { "#test/*": "./test/*" } },
]) {
	ruleStory.it(
		`manifests/exports-shape rejects public private-only conventions ${JSON.stringify(fields)}`,
		[repositoryHas(exportsWorkspace, exportsPackage(fields, LIBRARY_MANIFEST))],
		function* ({ check }) {
			const findings = yield* check(manifestsExportsShape);

			expect(findings).toEqual([
				{
					file: LIBRARY_MANIFEST,
					message: expect.stringContaining(fields.imports["#test/*"] === undefined ? 'Export "./*" does not preserve' : 'Import "#test/*" must map'),
					subject: fields.imports["#test/*"] === undefined ? "./*" : "#test/*",
				},
			]);
		},
	);
}
