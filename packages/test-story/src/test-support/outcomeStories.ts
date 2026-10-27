import { outcomes } from "#outcomes.ts";
import { outcomeTable } from "./outcomeTable.ts";

outcomeTable.it("one wrong row", [], function* ({ next }) {
	yield* outcomes({
		"first reading": [next(), 10],
		"second reading": [next(), 2],
	});
});

outcomeTable.it("two wrong rows", [], function* ({ next }) {
	yield* outcomes({
		"first reading": [next(), 10],
		"second reading": [next(), 20],
	});
});

outcomeTable.it("unavailable readout", [], function* ({ unavailable }) {
	yield* outcomes({ "counter reading": [unavailable(), 0] });
});
