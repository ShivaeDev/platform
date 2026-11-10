import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { serviceDefinitionAssembly } from "#rules/effect/serviceDefinitionAssembly.ts";
import { effectInstalled } from "#test/consumerServices.ts";
import { biomeFormatted, repositoryHas as cliRepositoryHas, qualityInstalled, repositoryStory } from "#test/repositoryStory.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { ASSEMBLY_INVENTORY, assemblyFiles, serviceAssembly, serviceInstalled, statelessAssembly } from "#test/serviceAssemblyFiles.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

repositoryStory.it(
	"quality lint accepts ordinary operations, state factories and marked generic operations and factories",
	[
		qualityInstalled(),
		effectInstalled(),
		serviceInstalled(),
		cliRepositoryHas(...assemblyFiles, serviceAssembly(ASSEMBLY_INVENTORY)),
		biomeFormatted(),
	],
	function* ({ runs, outcome, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["gate", () => outcome(), "passed"],
			["report", () => stdout(), expect.stringContaining("quality: passed")],
		]);
	},
	CLI_TIMEOUT,
);

for (const [name, source] of [
	["Effect.void", statelessAssembly],
	[
		"Effect.void through a native module namespace",
		{
			...statelessAssembly,
			content: statelessAssembly.content
				.replace('import { Effect } from "effect";', 'import * as Fx from "effect/Effect";')
				.replace("Effect.void", "Fx.void"),
		},
	],
] as const) {
	ruleStory.it(
		`effect/service-definition-assembly accepts an aliased constructor and ${name}`,
		[repositoryHas(...assemblyFiles, source)],
		function* ({ check, messages }) {
			yield* check(serviceDefinitionAssembly);

			yield* assertThat(yield* messages(), (actual) => actual.toEqual([]));
		},
	);
}

ruleStory.it(
	"effect/service-definition-assembly rejects a namespace service constructor with the direct-import repair",
	[repositoryHas(...assemblyFiles, serviceAssembly(ASSEMBLY_INVENTORY, "", 'import * as Definitions from "@shivaedev/service/defineService.ts";'))],
	function* ({ check, messages }) {
		yield* check(serviceDefinitionAssembly);

		yield* assertThat(yield* messages(), (actual) => actual.toContainEqual("Import and call defineService directly."));
	},
);
