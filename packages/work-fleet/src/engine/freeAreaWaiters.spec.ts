import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

for (const areas of [["shared"], ["shared", "other"]]) {
	for (const age of ["stored", "legacy", "tied"]) {
		isolatedEngine.it(`equal ${age} launches for ${areas.join(" and ")} start oldest first`, [], function* (fleet) {
			fleet.setAreas("one", areas);
			fleet.setAreas("two", ["shared"]);
			fleet.setPriority("one", "high");
			fleet.setPriority("two", "high");
			for (const id of ["one", "two"]) {
				const prepared = yield* fleet.prepareWork(id);
				if (age === "legacy") {
					yield* fleet.replaceStoredRecord({ ...prepared.value, areaQueuedAt: undefined });
				}
				if (age !== "tied") {
					fleet.advanceTime(100);
				}
			}
			fleet.advanceTime(100);
			yield* fleet.restart();
			expect(yield* fleet.attemptDispatch("two")).toMatchObject({ message: "waiting for area shared queued ahead by one" });
			yield* fleet.schedule();
			yield* outcomes({
				"the later launch stays queued": [
					fleet.get("two").pipe(Effect.map(({ value }) => ({ attempts: value.attempts, step: value.step }))),
					{ attempts: [], step: "queued" },
				],
				"the oldest launch starts": [fleet.get("one").pipe(Effect.map(({ value }) => value.step)), "working"],
			});
			yield* fleet.finishWorker("one");
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			yield* fleet.schedule();
			expect((yield* fleet.get("two")).value.step).toBe("working");
			expect(fleet.providerStarts().filter(({ access }) => access !== "read-only")).toMatchObject([
				{ prompt: "Implement one" },
				{ prompt: "Implement two" },
			]);
		});
	}
}

isolatedEngine.it("three free-area launches choose priority before waiting age", [], function* (fleet) {
	for (const [id, priority] of [
		["one", "normal"],
		["two", "high"],
		["three", "high"],
	] as const) {
		fleet.approveWork(id, `board-${id}`);
		fleet.setAreas(id, ["shared"]);
		fleet.setPriority(id, priority);
		yield* fleet.prepareWork(id);
		fleet.advanceTime(100);
	}
	for (const id of ["two", "three", "one"]) {
		yield* fleet.schedule();
		expect((yield* fleet.get(id)).value.step).toBe("working");
		yield* fleet.finishWorker(id);
		expect((yield* fleet.reconcile(id)).value.step).toBe("done");
	}
	expect(fleet.providerStarts().filter(({ access }) => access !== "read-only")).toMatchObject([
		{ prompt: "Implement two" },
		{ prompt: "Implement three" },
		{ prompt: "Implement one" },
	]);
});

isolatedEngine.it("continuing completed work waits behind an existing free-area launch", [noChangeReported()], function* (fleet) {
	fleet.setAreas("one", ["shared"]);
	fleet.setAreas("two", ["shared"]);
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.finishWorker("one");
	expect((yield* fleet.reconcile("one")).value.step).toBe("done");
	fleet.advanceTime(100);
	yield* fleet.prepareWork("two");
	fleet.advanceTime(100);
	expect(yield* fleet.attemptContinue("one", "Check the follow-up")).toMatchObject({ message: "waiting for area shared queued ahead by two" });
	yield* fleet.schedule();
	expect((yield* fleet.get("two")).value.step).toBe("working");
	yield* fleet.finishWorker("two");
	expect((yield* fleet.reconcile("two")).value.step).toBe("done");
	const continued = yield* fleet.continueWork("one", "Check the follow-up");
	expect(continued.value.step).toBe("working");
});
