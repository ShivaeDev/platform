import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { record } from "#test/storage.ts";
import { storage } from "#test/storageStory.ts";

storage.it("a custom admission sees the current records by default", [], function* ({ admittingStore, store }) {
	yield* store.insert(record("other"));
	const custom = yield* admittingStore({});

	yield* custom.admit(record("one"));

	expect(yield* custom.seen()).toEqual([["other"]]);
});

storage.it(
	"an admission that opts out of the snapshot still runs without records and can refuse the write",
	[],
	function* ({ admittingStore, stepOf, store }) {
		yield* store.insert(record("other"));
		const custom = yield* admittingStore({ needsRecords: false, refuse: "Denied by application" });

		const admission = yield* custom.admit(record("denied"));

		expect(admission).toBe("admission refused: Denied by application");
		yield* outcomes([
			["records the admission saw", () => custom.seen(), [[]]],
			["denied record", () => stepOf("denied"), "missing"],
		]);
	},
);

storage.it("an admission without a snapshot still counts a live foreign execution", [], function* ({ admittingStore, store }) {
	const custom = yield* admittingStore({ needsRecords: false });
	yield* store.reserveForeign("external", { backlog: true, executing: true });

	const admission = yield* custom.admit({ ...record("one"), step: "submitting" }, { maxExecuting: 1 });

	expect(admission).toBe("execution capacity of 1 is full");
});

storage.it("an admission without a snapshot still counts submissions against the shared quota", [], function* ({ admittingStore, store, workIds }) {
	const custom = yield* admittingStore({ needsRecords: false });
	yield* store.insert({ ...record("submitted"), step: "submitting", submittedAt: 101 });

	const admission = yield* custom.admit({ ...record("two"), step: "submitting", submittedAt: 101 }, { quota: { available: 1, observedAt: 100 } });

	expect(admission).toBe("quota exhausted");
	expect(yield* workIds()).toEqual(["submitted"]);
});

storage.it("single and listed reads refuse a stored record with an unknown step", [], function* ({ corruptStep, listOutcome, readOutcome, store }) {
	yield* store.insert(record("one"));

	yield* corruptStep("one", "invalid-step");

	yield* outcomes([
		["single read", () => readOutcome("one"), expect.stringMatching(/^invalid stored data/u)],
		["listed read", () => listOutcome(), expect.stringMatching(/^invalid stored data/u)],
	]);
});
