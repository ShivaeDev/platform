import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ci, lockPathsFrom, lockStory, unreadableConfiguration } from "#test/kit.ts";

lockStory.it(
	"with no lock path, HEAVY_PROCESS_LOCK or HOME, ready fails with a heavy-lock error saying how to locate the lock",
	[lockPathsFrom([])],
	function* ({ starts, stateOf }) {
		yield* starts("ready");

		expect(yield* stateOf("ready")).toBe('failed with heavy-lock error "Set HOME or HEAVY_PROCESS_LOCK to locate the lock file."');
	},
);

lockStory.it(
	'with CI "true" but no lock path, HEAVY_PROCESS_LOCK or HOME, ready still fails with the heavy-lock error saying how to locate the lock',
	[lockPathsFrom([]), ci("true")],
	function* ({ starts, stateOf }) {
		yield* starts("ready");

		expect(yield* stateOf("ready")).toBe('failed with heavy-lock error "Set HOME or HEAVY_PROCESS_LOCK to locate the lock file."');
	},
);

lockStory.it(
	"with an unreadable configuration, ready fails with a heavy-lock error that keeps the read failure as its cause",
	[unreadableConfiguration()],
	function* ({ failureCauseOf, starts, stateOf }) {
		yield* starts("ready");

		yield* outcomes({
			"ready": [stateOf("ready"), 'failed with heavy-lock error "Could not read the heavy-lock environment."'],
			"ready's failure cause": [failureCauseOf("ready"), "ConfigError(SourceError: Failed to read file at <story directory>/CI)"],
		});
	},
);
