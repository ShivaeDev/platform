import { expect } from "vitest";
import { genreTags } from "#genreTags.ts";
import { storyRunner } from "#test/storyRunner.ts";

const SLOW = 30_000;

storyRunner.it(
	"names every story after its kit's genre, and silently tags none when the config declares no genre",
	[],
	function* ({ genres }) {
		expect(yield* genres({ tags: [] })).toEqual([
			"Bakery Story: a lit oven stays lit []: passed",
			"Mill Story: turning sails keep turning []: passed",
		]);
	},
	SLOW,
);

storyRunner.it(
	"runs only one genre's stories when a run filters by the name",
	[],
	function* ({ genres }) {
		expect(yield* genres({ tags: [], testNamePattern: "Mill Story: " })).toEqual([
			"Bakery Story: a lit oven stays lit []: skipped",
			"Mill Story: turning sails keep turning []: passed",
		]);
	},
	SLOW,
);

storyRunner.it(
	"tags the stories of each genre the config declares, so a run can filter by the tag",
	[],
	function* ({ genres }) {
		expect(yield* genres({ tags: genreTags("bakery", "mill"), tagsFilter: ["mill-story"] })).toEqual([
			"Bakery Story: a lit oven stays lit [bakery-story]: skipped",
			"Mill Story: turning sails keep turning [mill-story]: passed",
		]);
	},
	SLOW,
);

storyRunner.it(
	"tags only the genres the config declares",
	[],
	function* ({ genres }) {
		expect(yield* genres({ tags: genreTags("mill") })).toEqual([
			"Bakery Story: a lit oven stays lit []: passed",
			"Mill Story: turning sails keep turning [mill-story]: passed",
		]);
	},
	SLOW,
);

storyRunner.it(
	"keeps Vitest's specific error for an undeclared consumer tag",
	[],
	function* ({ run }) {
		const { moduleErrors, stories } = yield* run({
			include: "src/test-support/invalidTagStories.ts",
			tags: genreTags("bakery"),
		});
		expect(moduleErrors).toEqual([
			'The tag "undeclared-consumer-tag" is not defined in the configuration. Available tags are:\n- bakery-story: stories over a real bakery',
		]);
		expect(stories).toEqual([]);
	},
	SLOW,
);
