import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { outcomeTable, ReadoutUnavailable } from "#test/outcomeTable.ts";
import { storyRunner } from "#test/storyRunner.ts";

outcomeTable.it("reads matching rows in order before comparing them", [], function* ({ next, count, details }) {
	yield* outcomes({
		"first reading": [next(), 1],
		"second reading": [next(), 2],
		"total readings": [count(), 2],
		"view details": [details(), expect.objectContaining({ count: 2 })],
	});
	expect(yield* details()).toEqual({ count: 2, status: "ready" });
});

outcomeTable.it("keeps a failing readout in the typed error channel", [], function* ({ unavailable }) {
	const error = yield* Effect.flip(outcomes({ "counter reading": [unavailable(), 0] }));
	expect(error).toEqual(new ReadoutUnavailable({ message: "the counter is unavailable" }));
});

storyRunner.it(
	"reports each mismatched row and the outcomes call in the spec",
	[],
	function* ({ run }) {
		const result = yield* run({ include: "src/test-support/outcomeStories.ts" });
		expect(result).toEqual({
			moduleErrors: [],
			stories: [
				{
					diffs: [expect.stringContaining('"first reading"')],
					errors: [expect.stringContaining("at src/test-support/outcomeStories.ts:5:")],
					name: "Outcome Table Story: one wrong row",
					state: "failed",
					tags: [],
				},
				{
					diffs: [expect.stringContaining('"second reading"')],
					errors: [expect.stringContaining("at src/test-support/outcomeStories.ts:12:")],
					name: "Outcome Table Story: two wrong rows",
					state: "failed",
					tags: [],
				},
				{
					diffs: [undefined],
					errors: [expect.stringContaining("the counter is unavailable")],
					name: "Outcome Table Story: unavailable readout",
					state: "failed",
					tags: [],
				},
			],
			warnings: [],
		});
		const changedRows = result.stories.map(({ diffs }) => diffs?.[0]?.split("\n").filter((line) => /^[-+]\s+"/u.test(line)));
		expect(changedRows).toEqual([
			['-   "first reading": 10,', '+   "first reading": 1,'],
			['-   "first reading": 10,', '-   "second reading": 20,', '+   "first reading": 1,', '+   "second reading": 2,'],
			undefined,
		]);
	},
	30_000,
);
