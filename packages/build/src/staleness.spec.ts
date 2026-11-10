import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { generatedOnce, generator, notesProject } from "#test/generator.ts";

const NOTES = "src/generated/modules/notes/notes.ts";

generator.it(
	"after stats starts returning count as a string, tsc fails on the notes module naming stats and pnpm generate until generate runs again",
	[notesProject(), generatedOnce()],
	function* ({ compiles, edits, generates }) {
		expect(yield* compiles()).toBe("compiles cleanly");

		yield* edits("src/modules/notes/stats.ts", "readonly count: number;", "readonly count: string;");
		yield* edits("src/modules/notes/stats.ts", "count: rows.length,", "count: String(rows.length),");

		expect(yield* compiles()).toContain(
			`src/modules/notes/notes.ts(14,2): error TS2322: Type '"notes"' is not assignable to type '"notes" & NoInfer<WireSuccessStale<"stats", "the generated file is stale; run pnpm generate"`,
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
