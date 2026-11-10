import { expect } from "vitest";
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

		expect(yield* generates()).toEqual({ files: { [NOTES]: "written" }, problems: [], programBuilt: false, result: "succeeded" });
		expect(yield* generatedFile(NOTES)).toBe(written);
	},
);
