import { expect } from "vitest";
import { genreTags } from "#genreTags.ts";
import { outcomes } from "#outcomes.ts";
import { storyRunner } from "#test/storyRunner.ts";

const BAKERY_TAGS = { tags: genreTags("bakery") };
const VARIANTS = ["plain", "fails", "only", "skip", "runIf true", "runIf false", "skipIf false", "skipIf true"];

storyRunner.it("skips every story of a disabled kit, the focused one included", [], function* ({ results, run }) {
	yield* run("disabledStories", BAKERY_TAGS);

	expect(yield* results()).toEqual(VARIANTS.map((variant) => `Bakery Story: ${variant} [bakery-story]: skipped`));
});

storyRunner.it("skips a story of a kit that extends a disabled kit without running its setup", [], function* ({ lifetime, results, run }) {
	yield* run("composedDisabledStories", BAKERY_TAGS);

	yield* outcomes({
		results: [results(), ["Bakery Story: joins a disabled bakery [bakery-story]: skipped"]],
		"what ran": [lifetime(), []],
	});
});

storyRunner.it("never acquires a disabled kit's layer or runs its around, creation, traits or bodies", [], function* ({ lifetime, run }) {
	yield* run("disabledStories", BAKERY_TAGS);

	expect(yield* lifetime()).toEqual([]);
});

for (const [variant, outcome] of [
	["plain", "passed"],
	["fails", "passed"],
	["runIf true", "passed"],
	["skipIf false", "passed"],
] as const) {
	storyRunner.it(
		`runs the setup and body of an enabled kit's ${variant} story and reports it ${outcome}`,
		[],
		function* ({ lifetime, outcome: outcomeOf, runStory }) {
			yield* runStory("enabledStories", `Bakery Story: ${variant}`, BAKERY_TAGS);

			yield* outcomes({
				outcome: [outcomeOf(), outcome],
				"what ran": [lifetime(), ["layer", "around", "create", "trait", "body"]],
			});
		},
	);
}

for (const variant of ["skip", "runIf false", "skipIf true"]) {
	storyRunner.it(`skips an enabled kit's ${variant} story without running its setup`, [], function* ({ lifetime, outcome, runStory }) {
		yield* runStory("enabledStories", `Bakery Story: ${variant}`, BAKERY_TAGS);

		yield* outcomes({
			outcome: [outcome(), "skipped"],
			"what ran": [lifetime(), []],
		});
	});
}

storyRunner.it("runs only the focused story of an enabled kit", [], function* ({ results, run }) {
	yield* run("onlyStories", { ...BAKERY_TAGS, allowOnly: true });

	expect(yield* results()).toEqual(["Bakery Story: focused [bakery-story]: passed", "Bakery Story: plain [bakery-story]: skipped"]);
});
