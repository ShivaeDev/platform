import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { conflictRepairCanRaceDispatch } from "#test/engineAreaTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

for (const [repairPriority, launchPriority] of [
	["urgent", "high"],
	["high", "high"],
	["normal", "low"],
	["normal", "urgent"],
] as const) {
	isolatedEngine.it(
		`a waiting ${repairPriority} conflict repair precedes a new ${launchPriority} launch unless its priority is strictly higher`,
		[conflictRepairCanRaceDispatch(true)],
		function* (fleet) {
			fleet.setAreas("one", ["shared"]);
			fleet.setPriority("one", repairPriority);
			yield* fleet.prepareWork("one");
			yield* fleet.dispatch("one");
			yield* fleet.finishWorker("one");
			expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("reviewed-pr-ready");
			fleet.advanceTime(5000);
			yield* fleet.reconcile("one");
			yield* fleet.reserveForeign("holder", ["shared"]);
			fleet.conflictPullRequest();
			expect((yield* fleet.reconcile("one")).value).toMatchObject({ blocker: "waiting for area shared held by holder", step: "repairing" });
			fleet.advanceTime(100);
			fleet.setAreas("two", ["shared"]);
			fleet.setPriority("two", launchPriority);
			yield* fleet.prepareWork("two");
			yield* fleet.restart();
			yield* fleet.vacateExecution("holder");
			if (launchPriority === "urgent") {
				expect((yield* fleet.dispatch("two")).value.step).toBe("working");
			} else {
				expect(yield* fleet.attemptDispatch("two")).toMatchObject({ message: "waiting for area shared queued ahead by one" });
				yield* fleet.schedule();
				yield* outcomes({
					"the new launch stays queued": [
						fleet.get("two").pipe(Effect.map(({ value }) => ({ attempts: value.attempts, step: value.step }))),
						{ attempts: [], step: "queued" },
					],
					"the repair takes the area without a blocker": [
						fleet.get("one").pipe(Effect.map(({ value }) => ({ blocker: value.blocker, role: value.attempts.at(-1)?.role, step: value.step }))),
						{ blocker: undefined, role: "repair", step: "working" },
					],
				});
			}
		},
	);
}

isolatedEngine.it(
	"equal repair waiters use waiting age rather than original preparation order across restart",
	[conflictRepairCanRaceDispatch(true)],
	function* (fleet) {
		for (const id of ["one", "two"]) {
			fleet.setAreas(id, ["shared"]);
			yield* fleet.prepareWork(id);
			yield* fleet.dispatch(id);
			yield* fleet.finishWorker(id);
			expect((yield* fleet.reconcile(id)).value.decision?.code).toBe("reviewed-pr-ready");
			fleet.advanceTime(5000);
			yield* fleet.reconcile(id);
		}
		yield* fleet.reserveForeign("holder", ["shared"]);
		fleet.conflictPullRequest();
		for (const id of ["two", "one"]) {
			expect((yield* fleet.reconcile(id)).value).toMatchObject({ blocker: "waiting for area shared held by holder", step: "repairing" });
			fleet.advanceTime(100);
		}
		yield* fleet.restart();
		yield* fleet.vacateExecution("holder");
		expect((yield* fleet.reconcile("one")).value).toMatchObject({ blocker: "waiting for area shared queued ahead by two", step: "repairing" });
		const started = yield* fleet.reconcile("two");
		expect(started.value).toMatchObject({ attempts: expect.arrayContaining([expect.objectContaining({ role: "repair" })]), step: "working" });
	},
);

isolatedEngine.it("a new launch starts immediately when no item waits for its areas", [], function* (fleet) {
	fleet.setAreas("one", ["shared"]);
	yield* fleet.prepareWork("one");
	expect((yield* fleet.dispatch("one")).value).toMatchObject({ step: "working" });
	expect(fleet.providerStarts()).toMatchObject([{ prompt: "Implement one" }]);
});

isolatedEngine.it("a revised queued brief rejoins behind existing equal-priority area waiters", [], function* (fleet) {
	fleet.setAreas("one", ["shared"]);
	fleet.setAreas("two", ["shared"]);
	yield* fleet.prepareWork("one");
	fleet.advanceTime(100);
	yield* fleet.prepareWork("two");
	fleet.advanceTime(100);
	fleet.reviseBrief("one", "revised-one");
	expect(yield* fleet.attemptDispatch("one")).toMatchObject({ message: "waiting for area shared queued ahead by two" });
	const started = yield* fleet.dispatch("two");
	expect(started.value.step).toBe("working");
});
