import { expect } from "@effect/vitest";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { PACKAGES, packageProgramFiles } from "#test/packageProgramFiles.ts";
import { qualityInstalled, repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

ruleStory.it(
	"type-checking rules that share each package's program report every package's findings in one lint",
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
