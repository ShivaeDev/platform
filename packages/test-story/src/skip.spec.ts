import { expect, it } from "vitest";
import { genreTags } from "#genreTags.ts";
import { runStories } from "#test/runStories.ts";

it("registers skip, skipIf and runIf stories without executing their setup or bodies", async () => {
	const result = await runStories({ include: "src/test-support/skippedStories.ts", tags: genreTags("bakery") });
	expect(result).toEqual({
		moduleErrors: [],
		stories: [
			{ errors: [], name: "Bakery Story: skips a story the way Vitest skips a test", state: "skipped", tags: ["bakery-story"] },
			{ errors: [], name: "Bakery Story: skips a story when the condition holds", state: "skipped", tags: ["bakery-story"] },
			{ errors: [], name: "Bakery Story: runs a story only when the condition holds", state: "skipped", tags: ["bakery-story"] },
			{ errors: [], name: "does not execute skipped story setup or bodies", state: "passed", tags: [] },
		],
		warnings: [],
	});
}, 30_000);
