import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { generatedFileAt, generator, linkToItselfAt, notesProject } from "#test/generator.ts";

const NOTES = "src/generated/modules/notes/notes.ts";
const GONE = "src/generated/modules/gone/gone.ts";

generator.it(
	"two generate runs that overlap on the notes project both succeed and leave what one run writes, with no other file under src/generated or in the cache",
	[notesProject()],
	function* ({ everythingUnder, generates, generatesWithCheck, heldGenerateContinues, removesTheCache, startsGeneratingHeld }) {
		yield* startsGeneratingHeld("the first generate", { before: "renaming its draft over", file: NOTES });
		const second = yield* generates();
		const first = yield* heldGenerateContinues("the first generate");

		yield* outcomes([
			["the second generate", () => Effect.succeed(second), { problems: [], result: "succeeded" }],
			["the first generate", () => Effect.succeed(first), { problems: [], result: "succeeded" }],
			["src/generated", () => everythingUnder("src/generated"), ["modules", "modules/notes", "modules/notes/notes.ts"]],
			[
				"the cache",
				() => everythingUnder("node_modules/.cache/@shivaedev/build"),
				["src", "src/modules", "src/modules/notes", "src/modules/notes/notes.ts.json"],
			],
		]);
		yield* removesTheCache();
		expect(yield* generatesWithCheck()).toEqual({ files: { [NOTES]: "current" }, problems: [], programBuilt: true, result: "succeeded" });
	},
);

generator.it(
	"a generate that comes to another run's draft folder after that run renamed its draft and removed the folder succeeds",
	[notesProject()],
	function* ({ heldGenerateContinues, startsGeneratingHeld }) {
		yield* startsGeneratingHeld("the first generate", { before: "renaming its draft over", file: NOTES });
		yield* startsGeneratingHeld("the second generate", { before: "listing the draft folder of", file: NOTES });

		yield* outcomes([
			["the first generate", () => heldGenerateContinues("the first generate"), { problems: [], result: "succeeded" }],
			["the second generate", () => heldGenerateContinues("the second generate"), { problems: [], result: "succeeded" }],
		]);
	},
);

for (const before of ["reading", "removing"] as const) {
	generator.it(
		`two generate runs that list the same orphan both succeed when one removes it while the other is held before ${before} it, and the orphan is gone`,
		[notesProject(), generatedFileAt(GONE, "src/modules/gone/gone.ts")],
		function* ({ generatedFile, generates, heldGenerateContinues, startsGeneratingHeld }) {
			yield* startsGeneratingHeld("the first generate", { before, file: GONE });
			const second = yield* generates();
			const first = yield* heldGenerateContinues("the first generate");

			yield* outcomes([
				["the second generate", () => Effect.succeed(second), { files: { [GONE]: "removed" }, problems: [], result: "succeeded" }],
				["the first generate", () => Effect.succeed(first), { problems: [], result: "succeeded" }],
				["the orphan", () => generatedFile(GONE), "missing"],
			]);
		},
	);
}

generator.it(
	"generate still stops on a file under src/generated it cannot read for a reason other than its absence",
	[notesProject(), linkToItselfAt("src/generated/modules/loop.ts")],
	function* ({ generatesUntilFileSystemError }) {
		expect(yield* generatesUntilFileSystemError()).toBe("BadResource: FileSystem.stat (src/generated/modules/loop.ts)");
	},
);
