import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { keyed } from "#test/keyed.ts";

keyed.it(
	"keyed work starts each present key once, including after its action completes",
	[],
	function* ({ started, settled, complete, stopped, refresh, unclaimedStarts }) {
		expect(yield* started()).toBe("initial");
		yield* settled();
		yield* complete(1);
		expect(yield* stopped()).toBe("initial");

		yield* refresh();
		yield* settled();

		expect(yield* unclaimedStarts()).toBe(0);
	},
);

keyed.it("removing a key interrupts its work and reappearing starts fresh work", [], function* ({ started, settled, remove, stopped, add }) {
	expect(yield* started()).toBe("initial");
	yield* settled();

	yield* remove(1);
	expect(yield* stopped()).toBe("initial");
	yield* settled();
	yield* add(1, "returned");

	expect(yield* started()).toBe("returned");
});

keyed.it(
	"a keyed defect fails its reconciler and closes sibling work",
	[],
	function* ({ started, settled, add, complete, failed, stoppedPair, failure }) {
		expect(yield* started()).toBe("initial");
		yield* settled();
		yield* add(2, "broken");
		expect(yield* started()).toBe("broken");
		yield* settled();

		yield* complete(2);
		yield* failed();

		yield* outcomes([
			["closed tasks", () => stoppedPair(), ["broken", "initial"]],
			["state", () => failure(), { status: "failed" }],
		]);
	},
);
