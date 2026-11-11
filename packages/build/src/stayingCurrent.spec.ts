import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { successOf } from "#test/generatedText.ts";
import { generatedFileAt, generatedOnce, generator, heavyLockHeldElsewhere, notesProject, ownFileInGenerated } from "#test/generator.ts";

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

generator.it(
	"after stats starts returning count as a string, tsc fails on the notes module naming stats and pnpm generate until generate runs again",
	[notesProject(), generatedOnce()],
	function* ({ compiles, edits, generates }) {
		yield* edits("src/modules/notes/stats.ts", "readonly count: number;", "readonly count: string;");
		yield* edits("src/modules/notes/stats.ts", "count: rows.length,", "count: String(rows.length),");

		expect(yield* compiles()).toContain(
			`src/modules/notes/notes.ts(15,2): error TS2322: Type '"notes"' is not assignable to type '"notes" & NoInfer<WireSuccessStale<"stats", "the generated file is stale; run pnpm generate"`,
		);
		yield* generates();
		expect(yield* compiles()).toBe("compiles cleanly");
	},
);

generator.it(
	"after create's invalidates changes, generate --check fails naming the stale file and pnpm generate, and the next generate writes the new invalidates",
	[notesProject(), generatedOnce()],
	function* ({ edits, generatedFile, generates, generatesWithCheck }) {
		yield* edits(
			"src/modules/notes/create.ts",
			"invalidates: () => [notes.list],",
			"invalidates: (_draft, card) => [notes.list, notes.item(card.id)],",
		);

		yield* outcomes([
			[
				"generate --check",
				() => generatesWithCheck(),
				{ files: { [NOTES]: "stale" }, problems: [`${NOTES} is stale; run \`pnpm generate\``], result: "failed" },
			],
			["generate", () => generates(), { files: { [NOTES]: "written" }, result: "succeeded" }],
			[
				"create's invalidates",
				() =>
					Effect.map(generatedFile(NOTES), (text) =>
						text
							.split("\n")
							.find((line) => line.includes("create: { invalidates"))
							?.trim(),
					),
				"create: { invalidates: (_draft, card) => [notes.list, notes.item(card.id)] },",
			],
		]);
	},
);

const NOTEBOOK = "src/generated/modules/notes/notebook.ts";
const ROUTES = "src/generated/routes.ts";
const ROUTES_TEXT = "export const routes = [];\n";

generator.it(
	"after the notes module is renamed, generate --check lists its old file as left from it, and generate removes that file but keeps one under src/generated that it did not write",
	[notesProject(), ownFileInGenerated(ROUTES, ROUTES_TEXT), generatedOnce()],
	function* ({ generatedFile, generates, generatesWithCheck, renames }) {
		yield* renames("src/modules/notes/notes.ts", "src/modules/notes/notebook.ts");

		yield* outcomes([
			[
				"generate --check",
				() => generatesWithCheck(),
				{
					files: { [NOTEBOOK]: "missing", [NOTES]: "orphaned" },
					problems: [
						`${NOTEBOOK} is missing; run \`pnpm generate\``,
						`${NOTES} is left from src/modules/notes/notes.ts, which defines no module any more; run \`pnpm generate\``,
					],
					result: "failed",
				},
			],
			["generate", () => generates(), { files: { [NOTEBOOK]: "written", [NOTES]: "removed" }, problems: [], result: "succeeded" }],
			["the old file", () => generatedFile(NOTES), "missing"],
			["the application's own file", () => generatedFile(ROUTES), ROUTES_TEXT],
		]);
	},
);

// On a case-insensitive file system both spellings name one file, as after a folder renamed by case alone; on a
// case-sensitive one they are two files. Either way the module its header names still exists, so nothing is removed.
generator.it(
	"generate removes no file whose header names a module that still exists, even under a folder spelled in another case",
	[notesProject(), generatedFileAt("src/generated/modules/Notes/notes.ts", "src/modules/notes/notes.ts")],
	function* ({ generates }) {
		expect(yield* generates()).toEqual({ files: { [NOTES]: "written" }, problems: [], programBuilt: true, result: "succeeded" });
	},
);

generator.it(
	"a generate that builds a program waits while another run holds the heavy lock, and writes the file once the lock is free",
	[notesProject(), heavyLockHeldElsewhere()],
	function* ({ generatedFile, heavyLockPollPasses, otherRunReleasesTheHeavyLock, startsGenerating, waitsForTheHeavyLock }) {
		yield* startsGenerating();
		yield* waitsForTheHeavyLock();
		expect(yield* generatedFile(NOTES)).toBe("missing");

		yield* otherRunReleasesTheHeavyLock();

		yield* outcomes([["generate", () => heavyLockPollPasses(), { files: { [NOTES]: "written" }, programBuilt: true, result: "succeeded" }]]);
	},
);

generator.it(
	"a generate with unchanged inputs finishes while another run holds the heavy lock",
	[notesProject(), generatedOnce(), heavyLockHeldElsewhere()],
	function* ({ generates }) {
		expect(yield* generates()).toMatchObject({ files: { [NOTES]: "unchanged" }, programBuilt: false });
	},
);
