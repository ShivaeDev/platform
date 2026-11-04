import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nonEffectFixFiles } from "#test/nonEffectFixFiles.ts";
import { qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

repositoryStory.it(
	"Quality fix formats non-Effect code while keeping async functions and ambient time",
	[qualityInstalled(), repositoryHas(...nonEffectFixFiles)],
	function* ({ outcome, reads, runs }) {
		yield* runs("fix");

		yield* outcomes([
			["fix", () => outcome(), "passed"],
			["source", () => reads("src/simulation/time.ts"), "export async function time() {\n\treturn Date.now();\n}\n"],
		]);
	},
	CLI_TIMEOUT,
);
