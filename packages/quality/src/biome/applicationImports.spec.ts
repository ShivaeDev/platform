import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { biome } from "#rules/biome.ts";
import { generatedApplication } from "#test/applicationFiles.ts";
import { linkPackage } from "#test/tree.ts";

const installed = ruleKit.trait("repository", "Quality is installed", (engine) => linkPackage(engine.root));

ruleKit.it(
	"Biome accepts an application's imports of the pieces its entry points bring and still rejects the rest",
	[installed, repositoryHas(...generatedApplication)],
	function* ({ checks }) {
		const findings = (yield* checks(biome)).filter((finding) => finding.subject === "lint/correctness/noUndeclaredDependencies");
		expect(findings.map((finding) => finding.file).toSorted()).toEqual(["src/admin.ts", "src/shipped.ts"]);
	},
);
