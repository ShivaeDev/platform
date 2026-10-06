import { readFileSync } from "node:fs";
import { describe, expect, it, onTestFailed } from "vitest";
import { hasBowls, hasDough, hasOrders, newBakery, ovenIsLit } from "#test/bakery.ts";

const reported: string[] = [];

function collectFailures(): void {
	onTestFailed(({ task }) => {
		reported.push(...(task.result?.errors ?? []).map((error) => error.message));
	});
}

const INTRO =
	'test-story: this test tells a story over a real bakery. "given" lines are its traits; the other lines were told by verbs and engine steps as they ran, each beside the spec line that caused it when known. ✗ marks where it stopped.';

function footer(test: string): string {
	return `The traits, verbs and engine steps live in the bakery story kit this test imports. Rerun: vitest run src/failureStory.spec.ts -t "${test}"`;
}

describe("a failed story test prints its story", () => {
	it("adds nothing when the story passes", () => {
		collectFailures();
		const { oven } = newBakery(ovenIsLit(), hasDough(1));

		expect(oven.bakesEverything().loaves).toBe(1);
	});

	it.fails("marks where an assertion stopped the story", () => {
		collectFailures();
		const { oven } = newBakery(ovenIsLit(), hasDough(1));

		expect(oven.bakesEverything().loaves, "loaves").toBe(2);
	});

	it.fails("marks the trait that refused", () => {
		collectFailures();
		newBakery(ovenIsLit(), hasDough(4), hasBowls(1));
	});

	it.fails("writes a bakery too large to print to a file", () => {
		collectFailures();
		const { story } = newBakery(hasOrders(60));

		expect(story.engine.orders, "orders").toHaveLength(0);
	});

	it("printed each story with its own failure only", () => {
		expect(reported).toEqual([
			[
				"loaves: expected 1 to be 2 // Object.is equality",
				"",
				INTRO,
				"  given  the oven is lit                  src/failureStory.spec.ts:30:30",
				"  given  the baker has 1 balls of dough   src/failureStory.spec.ts:30:43",
				"         1m a loaf comes out of the oven  src/failureStory.spec.ts:32:15",
				"✗        the test failed after the line above",
				"",
				'The bakery when the test failed: {"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":1,"minute":1,"orders":[],"ovenLit":true,"smoking":false,"starter":false}',
				"",
				footer("marks where an assertion stopped the story"),
			].join("\n"),
			[
				'the trait "the baker has 4 balls of dough" refused to set up the bakery: the bowls hold only 3',
				"help: a trait throws when the bakery it asks for cannot exist. Give the test traits that fit together, or fix the trait in the bakery story kit if this bakery should be possible.",
				"",
				INTRO,
				"  given  the oven is lit                 src/failureStory.spec.ts:37:13",
				"✗ given  the baker has 4 balls of dough  src/failureStory.spec.ts:37:26  refused",
				"  given  the bakery has 1 bowls          src/failureStory.spec.ts:37:39",
				"",
				'The bakery when the test failed: {"bowls":1,"capacity":3,"dough":0,"flour":0,"loaves":0,"minute":0,"orders":[],"ovenLit":true,"smoking":false,"starter":false}',
				"",
				footer("marks the trait that refused"),
			].join("\n"),
			[
				"orders: expected [ …(60) ] to have a length of +0 but got 60",
				"",
				INTRO,
				"  given  the bakery has 60 orders  src/failureStory.spec.ts:42:31",
				"✗        the test failed after the line above",
				"",
				"The bakery when the test failed is 2936 characters of JSON, too long to print here. Read it in node_modules/.cache/test-story/failurestory.spec.ts--writes-a-bakery-too-large-to-print-to-a-file--bakery.json",
				"",
				footer("writes a bakery too large to print to a file"),
			].join("\n"),
		]);
	});

	it("wrote the bakery that was too large to print as JSON", () => {
		const written: unknown = JSON.parse(
			readFileSync("node_modules/.cache/test-story/failurestory.spec.ts--writes-a-bakery-too-large-to-print-to-a-file--bakery.json", "utf8"),
		);

		expect(written).toEqual(expect.objectContaining({ orders: expect.arrayContaining(["order 60: a loaf of rye for the market stall"]) }));
	});
});
