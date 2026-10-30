import { expect } from "vitest";
import { genreTags } from "#genreTags.ts";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("names every story after its kit's genre and tags none when the config declares no genre", [], function* ({ results, run }) {
	yield* run("genreStories", { tags: [] });

	expect(yield* results()).toEqual(["Bakery Story: lights the oven []: passed", "Mill Story: turns the sails []: passed"]);
});

storyRunner.it("runs only one genre's stories when a run filters by its name", [], function* ({ results, run }) {
	yield* run("genreStories", { tags: [], testNamePattern: "Mill Story: " });

	expect(yield* results()).toEqual(["Bakery Story: lights the oven []: skipped", "Mill Story: turns the sails []: passed"]);
});

storyRunner.it("tags the stories of each genre the config declares, so a run can filter by the tag", [], function* ({ results, run }) {
	yield* run("genreStories", { tags: genreTags("bakery", "mill"), tagsFilter: ["mill-story"] });

	expect(yield* results()).toEqual(["Bakery Story: lights the oven [bakery-story]: skipped", "Mill Story: turns the sails [mill-story]: passed"]);
});

storyRunner.it("tags only the genres the config declares", [], function* ({ results, run }) {
	yield* run("genreStories", { tags: genreTags("mill") });

	expect(yield* results()).toEqual(["Bakery Story: lights the oven []: passed", "Mill Story: turns the sails [mill-story]: passed"]);
});

storyRunner.it("keeps Vitest's own error for a tag the consumer never declared", [], function* ({ results, run }) {
	yield* run("invalidTagStories", { tags: genreTags("bakery") });

	expect(yield* results()).toEqual([
		'module error: The tag "undeclared-consumer-tag" is not defined in the configuration. Available tags are:\n- bakery-story: stories over a real bakery',
	]);
});
