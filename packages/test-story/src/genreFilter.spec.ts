import { expect, it } from "vitest";
import { type GenreTag, genreTags } from "#genreTags.ts";
import { runStories } from "#test/runStories.ts";

async function storiesRunWith(run: { readonly tags: readonly GenreTag[]; readonly tagsFilter?: string[]; readonly testNamePattern?: string }) {
	const { moduleErrors, stories, warnings } = await runStories({ include: "src/test-support/genreStories.ts", ...run });
	return [
		...moduleErrors,
		...stories.map((story) => `${story.name} [${story.tags.join(", ")}]: ${story.state}`),
		...warnings.map((warning) => `stderr: ${warning}`),
	];
}

const SLOW = 30_000;

it(
	"names every story after its kit's genre, and silently tags none when the config declares no genre",
	async () => {
		expect(await storiesRunWith({ tags: [] })).toEqual([
			"Bakery Story: a lit oven stays lit []: passed",
			"Mill Story: turning sails keep turning []: passed",
		]);
	},
	SLOW,
);

it(
	"runs only one genre's stories when a run filters by the name",
	async () => {
		expect(await storiesRunWith({ tags: [], testNamePattern: "Mill Story: " })).toEqual([
			"Bakery Story: a lit oven stays lit []: skipped",
			"Mill Story: turning sails keep turning []: passed",
		]);
	},
	SLOW,
);

it(
	"tags the stories of each genre the config declares, so a run can filter by the tag",
	async () => {
		expect(await storiesRunWith({ tags: genreTags("bakery", "mill"), tagsFilter: ["mill-story"] })).toEqual([
			"Bakery Story: a lit oven stays lit [bakery-story]: skipped",
			"Mill Story: turning sails keep turning [mill-story]: passed",
		]);
	},
	SLOW,
);

it(
	"tags only the genres the config declares",
	async () => {
		expect(await storiesRunWith({ tags: genreTags("mill") })).toEqual([
			"Bakery Story: a lit oven stays lit []: passed",
			"Mill Story: turning sails keep turning [mill-story]: passed",
		]);
	},
	SLOW,
);

it("names the genre tag after the kit, with its words joined so a filter can name it", () => {
	expect(genreTags(" Game  Store ", "mill")).toEqual([
		{ description: "stories over a real Game Store", name: "game-store-story" },
		{ description: "stories over a real mill", name: "mill-story" },
	]);
});
