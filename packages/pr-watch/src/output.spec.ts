import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { baselineSaved, openPr, watching } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it(
	"shutdown interrupts a pending output callback and leaves the merge available after restart",
	[openPr(1), watching(1), baselineSaved],
	function* ({ blockNextOutput, interrupt, merges, outputCallback, printed, restart, savedSnapshot, startWatch }) {
		yield* merges(1);
		yield* blockNextOutput();
		yield* startWatch();
		expect(yield* outputCallback()).toBe("pending");

		yield* interrupt();

		yield* outcomes([
			["output callback", () => outputCallback(), "interrupted"],
			["printed", () => printed(), ["stopped: interrupted"]],
			["saved snapshot", () => savedSnapshot(1), "open, auto-merge"],
		]);

		yield* restart();

		expect(yield* printed()).toEqual(["stopped: interrupted", "PR 1 merged"]);
	},
);

watch.it(
	"a completed output callback saves the merge and does not repeat it after restart",
	[openPr(1), watching(1), baselineSaved],
	function* ({ merges, printed, restart, runOnce, savedSnapshot }) {
		yield* merges(1);

		yield* runOnce();

		yield* outcomes([
			["printed", () => printed(), ["PR 1 merged", "stopped: completed"]],
			["saved snapshot", () => savedSnapshot(1), "merged, auto-merge"],
		]);

		yield* restart();

		expect(yield* printed()).toEqual(["PR 1 merged", "stopped: completed"]);
	},
);

watch.it(
	"a refused stop emission after a successful round fails with a typed output error",
	[openPr(1), watching(1)],
	function* ({ programOutcome, refuseStopOutput, runOnce }) {
		yield* refuseStopOutput();

		yield* runOnce();

		expect(yield* programOutcome()).toEqual(["WatchError: Output stream failed"]);
	},
);

watch.it(
	"a refused stop emission preserves both the poll failure and the typed output error",
	[openPr(1), watching(1)],
	function* ({ fileOperationFails, programOutcome, refuseStopOutput, runOnce }) {
		yield* fileOperationFails("read");
		yield* refuseStopOutput();

		yield* runOnce();

		expect(yield* programOutcome()).toEqual(["WatchError: PermissionDenied: FileSystem.read", "WatchError: Output stream failed"]);
	},
);
