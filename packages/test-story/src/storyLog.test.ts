import { describe, expect, it, onTestFailed } from "vitest";
import { storyLog } from "#storyLog.ts";
import { hasDough, newBakery, ovenIsLit } from "#test/bakery.ts";

const reported: string[] = [];

function reportFailures(): void {
	onTestFailed(({ task }) => {
		reported.push(...(task.result?.errors ?? []).map((error) => error.message));
	});
}

describe("a failed test reports the story so far", () => {
	it("adds nothing when the story passes", () => {
		reportFailures();
		const { oven } = newBakery(ovenIsLit(), hasDough(1));

		expect(oven.bakesEverything().loaves).toBe(1);
	});

	it.fails("adds every line of the story to the failure", () => {
		reportFailures();
		const { oven } = newBakery(ovenIsLit(), hasDough(1));

		expect(oven.bakesEverything().loaves, "loaves").toBe(2);
	});

	it.fails("adds nothing for a log told to stay quiet", () => {
		reportFailures();
		const log = storyLog({ storyOnFailure: false });
		log.tell("the baker sleeps in");

		expect(log.lines, "quiet").toEqual([]);
	});

	it("reported the story only with the failure it belongs to", () => {
		expect(reported).toEqual([
			"loaves: expected 1 to be 2 // Object.is equality\n\nThe story so far:\n  the oven is lit\n  the baker has 1 balls of dough\n  1m a loaf comes out of the oven",
			expect.stringMatching(/^quiet: expected \[ 'the baker sleeps in' \] to deeply equal \[\]$/u),
		]);
	});
});
