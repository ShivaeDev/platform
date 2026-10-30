import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { biome } from "#rules/biome.ts";
import { helperNamed, invalidTestTitle, qualityInstalled, testTitlePreset } from "#test/titleInputs.ts";

for (const name of ["describe", "it", "test"]) {
	ruleKit.it(
		`Biome accepts an ordinary ${name} helper outside test code`,
		[repositoryHas(...testTitlePreset, helperNamed(name)), qualityInstalled],
		function* ({ checks }) {
			const findings = yield* checks(biome);

			expect(findings.filter((finding) => finding.subject === "lint/nursery/useValidTestTitle")).toEqual([]);
		},
	);
}

for (const path of ["src/titles.spec.ts", "src/titles.test.ts", "src/test-support/titles.ts"]) {
	ruleKit.it(
		`Biome rejects a non-string describe title in ${path}`,
		[repositoryHas(...testTitlePreset, invalidTestTitle(path)), qualityInstalled],
		function* ({ checks }) {
			const findings = yield* checks(biome);

			expect(findings.filter((finding) => finding.subject === "lint/nursery/useValidTestTitle").map((finding) => finding.file)).toEqual([path]);
		},
	);
}
