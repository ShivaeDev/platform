import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { effectInstalled } from "#test/consumerServices.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { ASSEMBLY_INVENTORY, assemblyFiles, serviceAssembly, serviceInstalled, statelessAssembly } from "#test/serviceAssemblyFiles.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const consumer = [qualityInstalled(), effectInstalled(), serviceInstalled(), repositoryHas(...assemblyFiles)];

repositoryStory.it(
	"quality lint accepts ordinary operations, state factories and marked generic operations and factories",
	[...consumer, repositoryHas(serviceAssembly(ASSEMBLY_INVENTORY)), biomeFormatted()],
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
	repositoryStory.it(
		`quality lint accepts an aliased constructor and ${name}`,
		[...consumer, repositoryHas(source), biomeFormatted()],
		function* ({ runs, outcome, stdout }) {
			yield* runs("lint");

			yield* outcomes([
				["gate", () => outcome(), "passed"],
				["report", () => stdout(), expect.stringContaining("quality: passed")],
			]);
		},
		CLI_TIMEOUT,
	);
}

repositoryStory.it(
	"quality lint rejects a namespace service constructor with the direct-import repair",
	[
		...consumer,
		repositoryHas(serviceAssembly(ASSEMBLY_INVENTORY, "", 'import * as Definitions from "@shivaedev/service/adapters/defineService.ts";')),
		biomeFormatted(),
	],
	function* ({ runs, outcome, stdout }) {
		yield* runs("lint");

		yield* outcomes([
			["gate", () => outcome(), "rejected"],
			["rule", () => stdout(), expect.stringContaining("error effect/service-definition-assembly")],
			["repair", () => stdout(), expect.stringContaining("Import and call defineService directly.")],
		]);
	},
	CLI_TIMEOUT,
);
