import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createVitest } from "vitest/node";
import { type GenreTag, genreTags } from "#genreTags.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

interface Run {
	readonly tags: readonly GenreTag[];
	readonly tagsFilter?: string[];
	readonly testNamePattern?: string;
}

async function storiesRunWith({ tags, tagsFilter = [], testNamePattern }: Run) {
	const stderr = new PassThrough();
	const warnings: string[] = [];
	stderr.on("data", (chunk: Buffer) => warnings.push(chunk.toString()));
	const vitest = await createVitest(
		"test",
		{
			config: false,
			include: ["src/test-support/genreStories.ts"],
			reporters: [],
			root,
			tags: [...tags],
			tagsFilter,
			watch: false,
			...(testNamePattern === undefined ? {} : { testNamePattern }),
		},
		{ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } } },
		{ stderr, stdout: new PassThrough() },
	);
	try {
		const { testModules } = await vitest.start();
		return testModules.flatMap((module) => [
			...module.errors().map((error) => error.message),
			...[...module.children.allTests()].map((test) => `${test.name} [${test.tags.join(", ")}]: ${test.result().state}`),
			...warnings.map((warning) => `stderr: ${warning}`),
		]);
	} finally {
		await vitest.close();
	}
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
		expect(await storiesRunWith({ tags: [], testNamePattern: "^Mill Story: " })).toEqual([
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
