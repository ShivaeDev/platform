import { expect } from "vitest";
import { answerStory } from "#test/answerStory.ts";

for (const [ending, answer] of [
	["fails", "failed with SQLSTATE 42501"],
	["dies", "died with SQLSTATE 42501"],
] as const) {
	answerStory.it(`the custom formatter keeps the error detail when the query ${ending}`, [], function* ({ rejectedQuery }) {
		expect(yield* rejectedQuery(ending)).toBe(answer);
	});
}
