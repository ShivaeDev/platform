import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";

application.it(
	"the starter passes the real Quality gate with an empty baseline",
	[],
	function* ({ lintStarter, scriptResult, starterFile }) {
		yield* lintStarter();

		yield* outcomes([
			["Quality gate", () => scriptResult(), "passed"],
			["starter baseline", () => starterFile("quality-baseline.jsonl"), ""],
		]);
	},
	120_000,
);
