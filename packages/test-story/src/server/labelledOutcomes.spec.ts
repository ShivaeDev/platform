import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { attempt } from "#test/attempt.ts";
import { OUTCOME_STORIES } from "#test/failureReport.ts";
import { outcomeTable } from "#test/outcomeTable.ts";
import { storyRunner } from "#test/storyRunner.ts";

outcomeTable.it("reads each row's readout once, in the order the rows are written", [], function* ({ count, next }) {
	yield* outcomes({
		"reading 1": [next(), 1],
		"reading 2": [next(), 2],
		"readings taken": [count(), 2],
	});
});

outcomeTable.it("compares a row against an asymmetric matcher", [], function* ({ details }) {
	yield* outcomes({ "view details": [details(), expect.objectContaining({ status: "ready" })] });
});

outcomeTable.it("keeps a failing readout in the typed error channel", [], function* ({ unavailable }) {
	expect(yield* attempt(outcomes({ "counter reading": [unavailable(), 0] }))).toBe("failed with ReadoutUnavailable: the counter is unavailable");
});

for (const [name, line, changedRows] of [
	["one wrong row", 5, ['-   "first reading": 10,', '+   "first reading": 1,']],
	["two wrong rows", 12, ['-   "first reading": 10,', '-   "second reading": 20,', '+   "first reading": 1,', '+   "second reading": 2,']],
] as const) {
	storyRunner.it(
		`reports only the mismatched rows of an outcomes call with ${name} at its line in the spec`,
		[],
		function* ({ changedRows: changedRowsOf, failedAt, runStory }) {
			yield* runStory("outcomeStories", `Outcome Table Story: ${name}`);

			yield* outcomes({
				"changed rows": [changedRowsOf(), [...changedRows]],
				"failed at": [failedAt(), `at ${OUTCOME_STORIES}:${line}:9`],
			});
		},
	);
}

storyRunner.it("fails an outcomes call with its readout's error and no diff", [], function* ({ changedRows, message, runStory }) {
	yield* runStory("outcomeStories", "Outcome Table Story: unavailable readout");

	yield* outcomes({
		"changed rows": [changedRows(), []],
		message: [message(), "the counter is unavailable"],
	});
});
