import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { successOf } from "#test/generatedText.ts";
import { generatedOnce, generator, notesProject } from "#test/generator.ts";

const NOTES = "src/generated/modules/notes/notes.ts";

generator.it(
	"a second generate with unchanged inputs builds no program and reports the module unchanged",
	[notesProject(), generatedOnce()],
	function* ({ generates }) {
		expect(yield* generates()).toEqual({ files: { [NOTES]: "unchanged" }, problems: [], programBuilt: false, result: "succeeded" });
	},
);

generator.it(
	"once the cache is removed, generate builds a program again and finds the file it wrote byte for byte current",
	[notesProject(), generatedOnce()],
	function* ({ generates, removesTheCache }) {
		yield* removesTheCache();

		expect(yield* generates()).toEqual({ files: { [NOTES]: "current" }, problems: [], programBuilt: true, result: "succeeded" });
	},
);

generator.it(
	"a generated file removed while the inputs stay the same comes back from the cache without a program",
	[notesProject(), generatedOnce()],
	function* ({ generatedFile, generates, removesTheGeneratedFile }) {
		const written = yield* generatedFile(NOTES);
		yield* removesTheGeneratedFile(NOTES);

		yield* outcomes([
			["generate", () => generates(), { files: { [NOTES]: "written" }, problems: [], programBuilt: false, result: "succeeded" }],
			["the generated file", () => generatedFile(NOTES), written],
		]);
	},
);

generator.it(
	"after the project's declaration file widens the global NoteLevel, generate builds a program and writes stats with the new level",
	[notesProject(), generatedOnce()],
	function* ({ edits, generatedFile, generates }) {
		yield* edits("src/types/noteLevel.d.ts", "1 | 2 | 3", "1 | 2 | 3 | 4");

		yield* outcomes([
			["generate", () => generates(), { files: { [NOTES]: "written" }, problems: [], programBuilt: true, result: "succeeded" }],
			[
				"stats' level",
				() => Effect.map(generatedFile(NOTES), (text) => successOf(text, "stats").includes("level: Schema.Literals([1, 2, 3, 4])")),
				true,
			],
		]);
	},
);
