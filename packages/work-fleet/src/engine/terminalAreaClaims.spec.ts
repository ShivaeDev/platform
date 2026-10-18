import { expect } from "vitest";
import { areaClaimsStory, overlappingAreas } from "#test/areaClaimsStory.ts";

areaClaimsStory.it("a restart drops a completed merged PR's saved claims before the waiting worker launches", [overlappingAreas], function* (fleet) {
	yield* fleet.prepare("one");
	yield* fleet.prepare("two");
	yield* fleet.dispatch("one");
	yield* fleet.schedule();
	expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area shared held by one");
	fleet.finishWorkers();
	yield* fleet.reconcile("one");
	yield* fleet.merge("one");
	const completed = (yield* fleet.reconcile("one")).value;
	expect(completed.stage).toBe("completed");
	expect(completed.outcome).toMatchObject({
		head: completed.result?.head,
		url: completed.result?.kind === "change" ? completed.result.pr : undefined,
	});
	yield* fleet.restart();
	expect((yield* fleet.get("one")).value.mergeAreasReleased).toBe(true);
	expect(fleet.recordedClaimRepairs().map((entry) => entry.annotations)).toEqual([
		{ area: "shared", stage: "completed", workId: "one" },
		{ area: "other", stage: "completed", workId: "one" },
	]);
	yield* fleet.schedule();
	const waiter = (yield* fleet.get("two")).value;
	expect(waiter.stage).toBe("executing");
	expect(waiter.blocker).toBeUndefined();
	expect(fleet.providerLaunches()).toContain("Implement two");
	yield* fleet.restart();
	yield* fleet.schedule();
	expect(fleet.recordedClaimRepairs()).toHaveLength(2);
});

for (const terminal of ["completed", "released"] as const) {
	areaClaimsStory.it(`each scheduler pass drops ${terminal} claims once without dropping a live holder`, [overlappingAreas], function* (fleet) {
		yield* fleet.prepare("one");
		yield* fleet.prepare("two");
		yield* fleet.dispatch("one");
		yield* fleet.schedule();
		expect(fleet.recordedClaimRepairs()).toEqual([]);
		expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area shared held by one");
		fleet.finishWorkers();
		yield* fleet.reconcile("one");
		if (terminal === "completed") {
			yield* fleet.merge("one");
			yield* fleet.reconcile("one");
		} else {
			yield* fleet.release("one");
		}
		yield* fleet.schedule();
		expect((yield* fleet.get("one")).value).toMatchObject({ mergeAreasReleased: true, stage: terminal });
		expect((yield* fleet.get("two")).value.stage).toBe("executing");
		expect(fleet.providerLaunches()).toContain("Implement two");
		expect(fleet.recordedClaimRepairs().map((entry) => entry.annotations)).toEqual([
			{ area: "shared", stage: terminal, workId: "one" },
			{ area: "other", stage: terminal, workId: "one" },
		]);
		yield* fleet.schedule();
		expect(fleet.recordedClaimRepairs()).toHaveLength(2);
	});
}
