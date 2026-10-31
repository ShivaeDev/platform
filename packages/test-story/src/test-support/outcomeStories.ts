import { atLeast, atMost, greaterThan, lessThan } from "#adapters/outcomeMatchers.ts";
import { outcomes } from "#outcomes.ts";
import { outcomeTable } from "./outcomeTable.ts";

outcomeTable.it("one wrong row", [], function* ({ next }) {
	yield* outcomes([
		["first reading", () => next(), 10],
		["second reading", () => next(), 2],
	]);
});

outcomeTable.it("two wrong rows", [], function* ({ next }) {
	yield* outcomes([
		["first reading", () => next(), 10],
		["second reading", () => next(), 20],
	]);
});

outcomeTable.it("unavailable readout", [], function* ({ next, unavailable }) {
	yield* outcomes([
		["counter reading", () => unavailable(), 0],
		["later reading", () => next(), 1],
	]);
});

outcomeTable.it("rows tell their lines in stated order", [], function* ({ next }) {
	yield* outcomes([
		["z reading", () => next(), 10],
		["a reading", () => next(), 2],
		["z reading", () => next(), 0],
	]);
});

outcomeTable.it("nested partial mismatch", [], function* ({ details, next }) {
	yield* next();

	yield* outcomes([["counter details", () => details(), { counter: { reading: { value: 10 } } }]]);
});

for (const [name, bound] of [
	["lessThan", lessThan(1)],
	["atMost", atMost(0)],
	["greaterThan", greaterThan(1)],
	["atLeast", atLeast(2)],
] as const) {
	outcomeTable.it(`${name} mismatch`, [], function* ({ next }) {
		yield* outcomes([["counter reading", () => next(), bound]]);
	});
}
