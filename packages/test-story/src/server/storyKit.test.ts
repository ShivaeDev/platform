import { expect } from "@effect/vitest";
import { beforeEach } from "vitest";
import {
	bakerIsCalledAway,
	bakery,
	hasBowls,
	hasDough,
	hasFlourDelivered,
	hasFlourFromTheMill,
	hasNoBowls,
	hasOatsFromTheMill,
	hasRyeFromTheMill,
	hasSpoiledYeast,
	morningShift,
	ovenIsLit,
} from "#test/bakery.ts";

const failures = new Map<string, { readonly cause: unknown; readonly message: string }>();

const HELP = [
	"help: a trait throws when the bakery it asks for cannot exist. Give the test traits that fit together, or fix the trait",
	"      in the bakery story kit if this bakery should be possible.",
].join("\n");

beforeEach(({ onTestFailed }) => {
	onTestFailed(({ task }) => {
		const [failure] = task.result?.errors ?? [];
		if (failure !== undefined) {
			failures.set(task.name, { cause: failure.cause, message: failure.message.split("\n\n")[0] ?? "" });
		}
	});
});

bakery.it(
	"fills the pantry after the kitchen, whatever order the test names them in",
	[hasDough(6), bakery.traits(ovenIsLit(), hasBowls(2)), hasFlourDelivered(2)],
	({ story }) => {
		expect(story.engine.dough).toBe(6);
		expect(story.engine.flour).toBe(2);
	},
);

bakery.it("runs the hook after a stage even when no trait names that stage", [hasDough(3)], ({ story }) => {
	expect(story.engine.capacity).toBe(3);
});

bakery.it("tells one line per trait, in the order the test names them", [hasDough(2), morningShift()], ({ story }) => {
	expect(story.lines).toEqual(["the baker has 2 balls of dough", "the oven is lit", "the bakery has 1 bowls"]);
});

bakery.it("changes its own bakery", [hasBowls(2), hasDough(6)], ({ story }) => {
	expect(story.engine.dough).toBe(6);
});

bakery.it("starts every story on a fresh bakery", [], ({ story }) => {
	expect(story.engine.dough).toBe(0);
});

bakery.it.fails("refuses a trait that throws", [hasDough(4)]);
bakery.it.fails("refuses a trait whose effect fails with a tagged error", [hasFlourDelivered(9)]);
bakery.it.fails("refuses a trait whose effect fails with a string", [hasFlourFromTheMill()]);
bakery.it.fails("refuses a trait whose effect fails with a plain object", [hasOatsFromTheMill()]);
bakery.it.fails("refuses a trait whose effect fails with a tagged error that has fields", [hasRyeFromTheMill()]);
bakery.it.fails("refuses a trait whose effect dies", [hasSpoiledYeast()]);
bakery.it.fails("lets an interrupted trait stay interrupted", [bakerIsCalledAway(), hasDough(1)]);
bakery.it.fails("fails the story with a failing after hook's error", [hasNoBowls()]);

bakery.it("refused each impossible bakery by naming the trait, the cause and what to do", [], () => {
	expect(Object.fromEntries([...failures].map(([name, { message }]) => [name, message]))).toEqual({
		"Bakery Story: fails the story with a failing after hook's error": "NoBowls",
		"Bakery Story: lets an interrupted trait stay interrupted": "All fibers interrupted without error",
		"Bakery Story: refuses a trait that throws": `the trait "the baker has 4 balls of dough" refused to set up the bakery: the bowls hold only 3\n${HELP}`,
		"Bakery Story: refuses a trait whose effect dies": `the trait "the yeast has spoiled" refused to set up the bakery: the dough will not rise\n${HELP}`,
		"Bakery Story: refuses a trait whose effect fails with a plain object": `the trait "the mill has sent oats" refused to set up the bakery: {"mill":"closed","sacks":0}\n${HELP}`,
		"Bakery Story: refuses a trait whose effect fails with a string": `the trait "the mill has sent flour" refused to set up the bakery: the mill is closed\n${HELP}`,
		"Bakery Story: refuses a trait whose effect fails with a tagged error": [
			'the trait "the supplier has delivered 9 sacks of flour" refused to set up the bakery: SupplierShort: the supplier',
			"  delivers at most 5 sacks",
			HELP,
		].join("\n"),
		"Bakery Story: refuses a trait whose effect fails with a tagged error that has fields": `the trait "the mill has sent rye" refused to set up the bakery: MillClosed {"until":"Monday"}\n${HELP}`,
	});
});

bakery.it("kept what the trait threw as the cause of the refusal", [], () => {
	expect(failures.get("Bakery Story: refuses a trait that throws")?.cause).toEqual(expect.objectContaining({ message: "the bowls hold only 3" }));
});

bakery.it("names the test after the kit's genre", [], (_bakery, { task }) => {
	expect(task.name).toBe("Bakery Story: names the test after the kit's genre");
});

bakery.it("tags the test with the kit's genre when the config declares it", [], (_bakery, { task }) => {
	expect(task.tags).toEqual(["bakery-story"]);
});

bakery.it(
	"tags a test with a timeout with the kit's genre",
	[],
	(_bakery, { task }) => {
		expect(task.tags).toEqual(["bakery-story"]);
	},
	5000,
);

bakery.it(
	"keeps the test's own tags beside the kit's genre",
	[],
	(_bakery, { task }) => {
		expect(task.tags).toEqual(["bakery-story", "mill-story"]);
	},
	{ tags: ["mill-story"] },
);

bakery.it.runIf(true)("runs a story when the condition holds", [hasDough(2)], ({ story }) => {
	expect(story.engine.dough).toBe(2);
});

bakery.it(
	"accepts a single consumer tag beside the kit's genre",
	[],
	(_bakery, { task }) => {
		expect(task.tags).toEqual(["bakery-story", "mill-story"]);
	},
	{ tags: "mill-story" },
);
