import { expect, it } from "vitest";
import { genreTags } from "#genreTags.ts";

it("names the genre tag after the kit, with its words joined so a filter can name it", () => {
	expect(genreTags(" Game  Store ", "mill")).toEqual([
		{ description: "stories over a real Game Store", name: "game-store-story" },
		{ description: "stories over a real mill", name: "mill-story" },
	]);
});
