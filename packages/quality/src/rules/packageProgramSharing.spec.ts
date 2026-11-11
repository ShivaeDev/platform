import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { effectInstalled, repositoryHas as lintRunRepositoryHas, lintRunStory } from "#test/lintRuns.ts";
import { PACKAGES, packageProgramFiles } from "#test/packageProgramFiles.ts";
import { qualityInstalled, repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

ruleStory.it(
	"the rules that share each package's program and a rule with a program rooted at its own files report every package's findings in one lint",
	[qualityInstalled(), effectResolves(), repositoryHas(...packageProgramFiles)],
	function* ({ gate, gateReports }) {
		yield* gate();

		const services = yield* gateReports("effect/service-parameters");
		const contexts = yield* gateReports("effect/context-capture");
		for (const name of PACKAGES) {
			expect(services).toContain(`packages/${name}/src/store.ts:2  Parameter store carries a service.`);
			expect(contexts).toContain(`packages/${name}/src/application.ts:6  Do not re-provide a captured Effect context in core code.`);
		}
	},
	CLI_TIMEOUT,
);

lintRunStory.it(
	"a full lint builds each workspace package's program once for every type-checking rule that shares it, and one program rooted at the files effect/context-capture checks",
	[effectInstalled(), lintRunRepositoryHas(...packageProgramFiles)],
	function* ({ lints, reportsRule, spanCount }) {
		yield* lints("--full");

		yield* outcomes([
			["service parameters reported", () => reportsRule("effect/service-parameters"), true],
			["context capture reported", () => reportsRule("effect/context-capture"), true],
			["programs built", () => spanCount("TypeScriptProgram.sourcesProgram"), PACKAGES.length + 1],
		]);
	},
	CLI_TIMEOUT,
);
