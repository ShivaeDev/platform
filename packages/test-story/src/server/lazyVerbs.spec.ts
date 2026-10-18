import { Effect } from "effect";
import { expect } from "vitest";
import { storyKit } from "#storyKit.ts";

const reads: string[] = [];
const kit = storyKit({
	clock: "live",
	create: () => ({}),
	name: "reader",
	stages: ["opened"],
	verbs: () => ({
		open: () => Effect.sync(() => "the opened page"),
		get unopened(): string {
			reads.push("unopened");
			throw new Error("Nobody opened this part");
		},
	}),
});

kit.it("evaluates a verb getter only when the story reads it", [], function* ({ open }) {
	expect(yield* open()).toBe("the opened page");
	expect(reads).toEqual([]);
});
