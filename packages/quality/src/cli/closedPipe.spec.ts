import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityLifecycle } from "#test/qualityLifecycle.ts";

qualityLifecycle.it(
	"quality --help piped into a reader that has already exited ends as passed without an error",
	[],
	function* ({ outcome, pipesToClosedReader, stderr }) {
		yield* pipesToClosedReader("--help");

		yield* outcomes([
			["error output", () => stderr(), ""],
			["exit", () => outcome(), "passed"],
		]);
	},
);
