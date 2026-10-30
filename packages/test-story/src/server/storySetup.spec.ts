import { expect } from "vitest";
import { bakery, DOUGH_PER_BOWL, hasBowls, hasDough, hasFlourDelivered, morningShift, ovenIsLit } from "#test/bakery.ts";
import { storyRunner } from "#test/storyRunner.ts";

const SLOW = 30_000;
const DOUGH = 6;
const SACKS = 2;
const KNEADED = 2;

const HELP = [
	"help: a trait throws when the bakery it asks for cannot exist. Give the test traits that fit together, or fix the trait",
	"      in the bakery story kit if this bakery should be possible.",
].join("\n");

bakery.it(
	"applies kitchen traits before pantry traits, whatever order the test names them in",
	[hasDough(DOUGH), bakery.traits(ovenIsLit(), hasBowls(2))],
	({ pantry }) => {
		expect(pantry.dough()).toBe(DOUGH);
	},
);

bakery.it("runs a stage's after hook even when no trait names that stage", [], ({ kitchen }) => {
	expect(kitchen.capacity()).toBe(DOUGH_PER_BOWL);
});

bakery.it(
	"tells one given line per trait in the order the test names them, opening a bundle in place",
	[hasDough(2), morningShift()],
	({ story }) => {
		expect(story.lines).toEqual(["the baker has 2 balls of dough", "the oven is lit", "the bakery has 1 bowls"]);
	},
);

bakery.it("a trait reaches a service the kit's layer provides", [hasFlourDelivered(SACKS)], ({ pantry }) => {
	expect(pantry.flour()).toBe(SACKS);
});

for (const run of ["first", "second"]) {
	bakery.it(`the ${run} of two stories kneads into its own empty bakery`, [], ({ baker, pantry }) => {
		expect(pantry.dough()).toBe(0);

		baker.kneads(KNEADED);

		expect(pantry.dough()).toBe(KNEADED);
	});
}

for (const [story, title, refusal] of [
	[
		"asks for more dough than its bowl holds",
		"a trait that throws refuses the bakery with the trait's line, what it threw and what to change",
		`the trait "the baker has 4 balls of dough" refused to set up the bakery: the bowls hold only 3\n${HELP}`,
	],
	[
		"asks the supplier for more flour than it delivers",
		"a trait that fails with a tagged error refuses the bakery with the error's tag and message",
		[
			'the trait "the supplier has delivered 9 sacks of flour" refused to set up the bakery: SupplierShort: the supplier',
			"  delivers at most 5 sacks",
			HELP,
		].join("\n"),
	],
	[
		"waits for flour from a mill that fails with a string",
		"a trait that fails with a string refuses the bakery with that string",
		`the trait "the mill has sent flour" refused to set up the bakery: the mill is closed\n${HELP}`,
	],
	[
		"waits for oats from a mill that fails with a plain object",
		"a trait that fails with a plain object refuses the bakery with the object as JSON",
		`the trait "the mill has sent oats" refused to set up the bakery: {"mill":"closed","sacks":0}\n${HELP}`,
	],
	[
		"waits for rye from a mill that fails with a tagged error that has fields",
		"a trait that fails with a tagged error without a message refuses the bakery with its tag and fields",
		`the trait "the mill has sent rye" refused to set up the bakery: MillClosed {"until":"Monday"}\n${HELP}`,
	],
	[
		"bakes with yeast that dies",
		"a trait that dies refuses the bakery with the defect's message",
		`the trait "the yeast has spoiled" refused to set up the bakery: the dough will not rise\n${HELP}`,
	],
	[
		"loses its baker to an interruption",
		"an interrupted trait leaves the story interrupted instead of refused",
		"All fibers interrupted without error",
	],
	["has a kitchen whose after hook finds no bowls", "a failing after hook fails the story with its error's tag", "NoBowls"],
] as const) {
	storyRunner.it(
		title,
		[],
		function* ({ message, runStory }) {
			yield* runStory("refusingStories", `Bakery Story: ${story}`);

			expect(yield* message()).toBe(refusal);
		},
		SLOW,
	);
}

storyRunner.it(
	"a refusal keeps what the trait threw as its cause",
	[],
	function* ({ cause, runStory }) {
		yield* runStory("refusingStories", "Bakery Story: asks for more dough than its bowl holds");

		expect(yield* cause()).toBe("the bowls hold only 3");
	},
	SLOW,
);

bakery.it("names the test after the kit's genre", [], (_bakery, { task }) => {
	expect(task.name).toBe("Bakery Story: names the test after the kit's genre");
});

const taggedTests: readonly (readonly [string, number | { readonly tags: string | string[] } | undefined, readonly string[]])[] = [
	["no options", undefined, ["bakery-story"]],
	["a timeout", SLOW, ["bakery-story"]],
	["its own tag list", { tags: ["mill-story"] }, ["bakery-story", "mill-story"]],
	["a single tag of its own", { tags: "mill-story" }, ["bakery-story", "mill-story"]],
];

for (const [given, options, tags] of taggedTests) {
	bakery.it(
		`a test given ${given} carries the tags ${tags.join(" and ")}`,
		[],
		(_bakery, { task }) => {
			expect(task.tags).toEqual(tags);
		},
		options,
	);
}
