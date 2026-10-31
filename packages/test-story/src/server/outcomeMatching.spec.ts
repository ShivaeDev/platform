import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { outcomeTable } from "#test/outcomeTable.ts";
import { storyRunner } from "#test/storyRunner.ts";

outcomeTable.it("matches partial objects at every depth", [], function* ({ details, next }) {
	yield* next();

	yield* outcomes([["counter details", () => details(), { counter: { reading: { value: 1 } } }]]);
});

storyRunner.it(
	"prints construction and execution lines in stated row order, including repeated labels",
	[],
	function* ({ changedRows, outcome, runStory }) {
		yield* runStory("outcomeStories", "Outcome Table Story: rows tell their lines in stated order");

		const report = yield* outcome();
		expect(report).toContain(
			[
				"         read after 0 readings",
				"         received reading 1",
				"         read after 1 readings",
				"         received reading 2",
				"         read after 2 readings",
				"         received reading 3",
			].join("\n"),
		);
		expect(yield* changedRows()).toEqual(['-     "z reading": 10,', '+     "z reading": 1,', '-     "z reading": 0,', '+     "z reading": 3,']);
	},
);

storyRunner.it("shows the label and nested mismatch without unrelated fields in the diff", [], function* ({ diff, runStory }) {
	yield* runStory("outcomeStories", "Outcome Table Story: nested partial mismatch");

	const mismatch = yield* diff();
	expect(mismatch).toContain('"counter details": {');
	expect(mismatch).toContain('"counter": {');
	expect(mismatch).toContain('"reading": {');
	expect(mismatch).toContain('-           "value": 10,');
	expect(mismatch).toContain('+           "value": 1,');
	expect(mismatch).not.toContain('"status"');
});
