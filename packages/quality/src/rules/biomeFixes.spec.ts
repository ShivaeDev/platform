import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";

const UNSORTED_DUPLICATES = { content: "export const b = { z: 1, a: 2 }\nexport const twice = { a: 1, a: 2 }\n", path: "src/b.ts" };

const TWO_ROUNDS = { content: 'export function isA(text: string): boolean {\n\treturn text.indexOf("a") == 0;\n}\n', path: "src/is-a.ts" };

repositoryStory.it(
	"quality fix formats a file but keeps its key order and duplicate keys for a person to decide on",
	[qualityInstalled(), repositoryHas(UNSORTED_DUPLICATES)],
	function* ({ reads, runs }) {
		yield* runs("fix");

		expect(yield* reads("src/b.ts")).toBe("export const b = { z: 1, a: 2 };\nexport const twice = { a: 1, a: 2 };\n");
	},
);

repositoryStory.it(
	"quality lint reports unsorted keys under biome/assist/source/useSortedKeys and duplicate keys under biome/lint/suspicious/noDuplicateObjectKeys",
	[qualityInstalled(), repositoryHas(UNSORTED_DUPLICATES)],
	function* ({ runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"duplicate keys": [stdout(), expect.stringContaining("error biome/lint/suspicious/noDuplicateObjectKeys (1)\n  src/b.ts:2")],
			"unsorted keys": [
				stdout(),
				expect.stringContaining("error biome/assist/source/useSortedKeys (1)\n  src/b.ts:1  The object properties are not sorted by key."),
			],
		});
	},
);

repositoryStory.it(
	"quality fix applies unsafe fixes and repeats Biome rounds until one rewrites nothing, since one fix can make room for another",
	[qualityInstalled(), repositoryHas(TWO_ROUNDS)],
	function* ({ reads, runs, stdout }) {
		yield* runs("fix");

		yield* outcomes({
			"fixed source": [reads("src/is-a.ts"), 'export function isA(text: string): boolean {\n\treturn text.startsWith("a");\n}\n'],
			"report": [
				stdout(),
				expect.stringContaining(
					[
						"quality: Biome round 1 rewrote 1 file with fixes and 0 files with the format pass.",
						"quality: Biome round 2 rewrote 1 file with fixes and 0 files with the format pass.",
						"quality: Biome round 3 rewrote 0 files with fixes and 0 files with the format pass.",
					].join("\n"),
				),
			],
		});
	},
);
