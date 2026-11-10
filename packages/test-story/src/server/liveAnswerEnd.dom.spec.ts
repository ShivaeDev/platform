import { expect } from "@effect/vitest";
import { answerScreen } from "#test/answerScreen.ts";

for (const source of ["empty", "unchanged"] as const) {
	answerScreen.it(
		`an ${source} answer stream ending fails the live answer wait with its typed reason`,
		[],
		function* ({ startWaiting, repeatAnswerCount, endAnswers }) {
			const wait = yield* startWaiting();
			if (source === "unchanged") {
				yield* repeatAnswerCount();
			}
			expect(yield* wait.state).toBe("waiting");

			yield* endAnswers();

			expect(yield* wait.finish).toBe(
				[
					"Waited for a live answer to the page after the action above, none arrived: the query's answers ended.",
					"help: the server pushed no result for this query after the action. Check that the action changes what the query",
					"      reads, or settle without this wait when the command's own reply updates the screen.",
				].join("\n"),
			);
		},
	);
}

answerScreen.it("a live answer resolves the waiting screen before the answers end", [], function* ({ startWaiting, deliverAnswer }) {
	const wait = yield* startWaiting();
	expect(yield* wait.state).toBe("waiting");

	yield* deliverAnswer();

	expect(yield* wait.finish).toBe("received");
});
