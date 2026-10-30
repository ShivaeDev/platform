import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { biome } from "#rules/biome.ts";
import { importForms, realWrappers, secondNameFiles, typeImportForms } from "#test/secondNameFiles.ts";
import { qualityInstalled, testTitlePreset } from "#test/titleInputs.ts";
import { noBarrel } from "./noBarrel.ts";

for (const file of secondNameFiles) {
	ruleKit.it(
		`the author sees a ${file.shape} and its defining module`,
		[repositoryHas(...testTitlePreset, file), qualityInstalled],
		function* ({ checks }) {
			const findings = yield* checks(file.shape === "type alias" ? biome : noBarrel);
			expect(findings.filter(({ message }) => message.includes("second name"))).toEqual([
				expect.objectContaining({ file: file.path, line: 2, message: expect.stringContaining("Help: Import") }),
			]);
			expect(findings.find(({ message }) => message.includes("second name"))?.message).toContain('"./owner.ts"');
		},
	);
}

ruleKit.it(
	"wrappers that add behaviour keep their own names",
	[repositoryHas(...testTitlePreset, realWrappers), qualityInstalled],
	function* ({ checks }) {
		expect(yield* checks(noBarrel)).toEqual([]);
		const findings = yield* checks(biome);
		expect(findings.filter(({ message }) => message.startsWith("A module never re-exports"))).toEqual([]);
	},
);

ruleKit.it("aliases through default, namespace, renamed and later exports name their owners", [repositoryHas(importForms)], function* ({ checks }) {
	const findings = yield* checks(noBarrel);
	expect(findings.map(({ line }) => line)).toEqual([4, 5, 6]);
	expect(findings.map(({ message }) => message)).toEqual([
		expect.stringContaining('"./default.ts"'),
		expect.stringContaining('"./owner.ts"'),
		expect.stringContaining('"./renamed.ts"'),
	]);
});

ruleKit.it(
	"type aliases of renamed, inline-type and default imports identify their defining modules",
	[repositoryHas(...testTitlePreset, typeImportForms), qualityInstalled],
	function* ({ checks }) {
		const findings = (yield* checks(biome)).filter(({ message }) => message.startsWith("A module never re-exports"));
		expect(findings.map(({ line }) => line)).toEqual([4, 5, 6]);
		expect(findings.map(({ message }) => message)).toEqual([
			expect.stringContaining('"./owner.ts"'),
			expect.stringContaining('"./other.ts"'),
			expect.stringContaining('"./default.ts"'),
		]);
	},
);
