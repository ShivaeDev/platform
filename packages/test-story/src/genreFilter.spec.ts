import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createVitest } from "vitest/node";
import { type GenreTag, genreTag } from "#genreTag.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

async function storiesRunWith(tags: readonly GenreTag[], tagsFilter: string[]) {
	const vitest = await createVitest(
		"test",
		{ config: false, include: ["src/test-support/genreStories.ts"], reporters: [], root, tags: [...tags], tagsFilter, watch: false },
		{ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } } },
		{ stderr: new PassThrough(), stdout: new PassThrough() },
	);
	try {
		const { testModules } = await vitest.start();
		return testModules.flatMap((module) => [
			...module.errors().map((error) => error.message),
			...[...module.children.allTests()].map((test) => `${test.name}: ${test.result().state}`),
		]);
	} finally {
		await vitest.close();
	}
}

const SLOW = 30_000;

it(
	"runs only the stories of the genre a run filters by",
	async () => {
		expect(await storiesRunWith([genreTag("bakery"), genreTag("mill")], ["mill-story"])).toEqual([
			"a lit oven stays lit: skipped",
			"turning sails keep turning: passed",
		]);
	},
	SLOW,
);

it(
	"tells a config that does not declare a kit's genre how to declare it",
	async () => {
		expect(await storiesRunWith([genreTag("mill")], [])).toEqual([
			[
				'the bakery story kit tags every test "bakery-story", but the Vitest config does not declare that tag',
				'help: add genreTag("bakery") from @shivaedev/test-story/genreTag.ts to test.tags in the Vitest config. The tag lets a run pick stories by genre with --tags-filter=bakery-story.',
			].join("\n"),
		]);
	},
	SLOW,
);

it("names the genre tag after the kit, with words joined so a filter can name it", () => {
	expect(genreTag(" game  store ")).toEqual({ description: "stories over a real game store", name: "game-store-story" });
});
