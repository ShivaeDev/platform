import { expect, it } from "vitest";
import { genreTags } from "#genreTags.ts";
import { runStories } from "#test/runStories.ts";

it("skips every variant of a disabled kit without executing setup or body", async () => {
	const result = await runStories({ include: "src/test-support/disabledStories.ts", tags: genreTags("bakery") });
	expect(result).toEqual({
		moduleErrors: [],
		stories: [
			...["plain", "fails", "only", "skip", "runIf true", "runIf false", "skipIf false", "skipIf true"].map((variant) => ({
				errors: [],
				name: `Bakery Story: ${variant}`,
				state: "skipped",
				tags: ["bakery-story"],
			})),
			{ errors: [], name: "never acquires the layer or runs around, creation, traits or bodies", state: "passed", tags: [] },
		],
		warnings: [],
	});
});

it("runs enabled variants, inverts fails and preserves explicit skips", async () => {
	const result = await runStories({ include: "src/test-support/enabledStories.ts", tags: genreTags("bakery") });
	expect(result).toEqual({
		moduleErrors: [],
		stories: [
			...[
				["plain", "passed"],
				["fails", "passed"],
				["skip", "skipped"],
				["runIf true", "passed"],
				["runIf false", "skipped"],
				["skipIf false", "passed"],
				["skipIf true", "skipped"],
			].map(([variant, state]) => ({ errors: [], name: `Bakery Story: ${variant}`, state, tags: ["bakery-story"] })),
			{ errors: [], name: "runs setup and body for each enabled story", state: "passed", tags: [] },
		],
		warnings: [],
	});
});

it("runs only the focused story in an enabled kit", async () => {
	const result = await runStories({ allowOnly: true, include: "src/test-support/onlyStories.ts", tags: genreTags("bakery") });
	expect(result).toEqual({
		moduleErrors: [],
		stories: [
			{ errors: [], name: "Bakery Story: focused", state: "passed", tags: ["bakery-story"] },
			{ errors: [], name: "Bakery Story: plain", state: "skipped", tags: ["bakery-story"] },
		],
		warnings: [],
	});
});
