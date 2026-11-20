import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heapLimitRun } from "#test/heapLimitRun.ts";

heapLimitRun.it(
	"a run that reaches Quality's heap limit ends as could not run, with a last line that names the limit and how to raise it",
	[],
	function* ({ exitCode, lastError, outgrowsLimit }) {
		yield* outgrowsLimit();

		yield* outcomes([
			["exit", () => exitCode(), 2],
			[
				"last error line",
				() => lastError(),
				"quality: Node aborted the run, as it does when the run reaches Quality's heap limit of 16 MB. Raise the limit with NODE_OPTIONS=--max-old-space-size=<megabytes>; Quality keeps a limit set there.",
			],
		]);
	},
);
