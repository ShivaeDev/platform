import { expect } from "vitest";
import { atLeast, atMost, greaterThan, lessThan } from "#adapters/outcomeMatchers.ts";
import { outcomes } from "#outcomes.ts";
import { outcomeTable } from "#test/outcomeTable.ts";
import { storyRunner } from "#test/storyRunner.ts";

for (const [name, bound] of [
	["lessThan", lessThan(2)],
	["atMost", atMost(1)],
	["greaterThan", greaterThan(0)],
	["atLeast", atLeast(1)],
] as const) {
	outcomeTable.it(`matches a ${name} bound at the row and inside nested objects`, [], function* ({ details, next }) {
		yield* outcomes([
			["counter reading", () => next(), bound],
			["counter details", () => details(), { counter: { reading: { value: bound } } }],
		]);
	});
}

for (const [name, limit] of [
	["lessThan", 1],
	["atMost", 0],
	["greaterThan", 1],
	["atLeast", 2],
] as const) {
	storyRunner.it(`prints the ${name} bound and the actual reading when it fails`, [], function* ({ diff, runStory }) {
		yield* runStory("outcomeStories", `Outcome Table Story: ${name} mismatch`);

		const mismatch = yield* diff();
		expect(mismatch).toContain(`-     "counter reading": ${name}(${limit}),`);
		expect(mismatch).toContain('+     "counter reading": 1,');
	});
}
