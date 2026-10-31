import { expect } from "vitest";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { liveClientSubscribed } from "#test/liveTraits.ts";

for (const [read, answer] of [
	["navigation", "internal server error"],
	["search", "internal server error"],
	["document", "internal server error"],
	["handoffs", "service unavailable: The workspace could not be indexed."],
] as const) {
	boardStory.it(
		`once an outside process removes the project folder, the board's ${read} read answers ${answer}`,
		[aQuestionnaire(), liveClientSubscribed],
		function* ({ boardRead, removeProject, watcherBecomes }) {
			expect(yield* boardRead(read)).toBe("answered");

			removeProject();
			yield* watcherBecomes("not watching");

			expect(yield* boardRead(read)).toBe(answer);
		},
	);
}
