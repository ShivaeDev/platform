import { expect } from "vitest";
import { fleetStory, githubBacklog } from "#test/fleetStory.ts";
import { markdownAreas } from "#test/markdownAreas.ts";

for (const restart of [false, true]) {
	fleetStory.it(
		`a deleted prepared item stops blocking its area on the next pass${restart ? " after restart" : ""}`,
		[markdownAreas],
		function* (fleet) {
			yield* fleet.prepare("three");
			yield* fleet.dispatch("three");
			yield* fleet.prepare("one");
			yield* fleet.prepare("two");
			yield* fleet.schedule();
			expect((yield* fleet.get("one")).value.blocker).toBe("waiting for area shared held by three");
			expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area shared held by three");
			fleet.finishWorkers();
			expect((yield* fleet.reconcile("three")).value.stage).toBe("completed");
			yield* fleet.deleteBoardItem("one");
			if (restart) {
				yield* fleet.rebuild();
			}
			yield* fleet.schedule();
			const waiter = (yield* fleet.get("two")).value;
			expect(waiter.stage).toBe("executing");
			expect(waiter.blocker).toBeUndefined();
			expect(fleet.launched).toContain(waiter.attempts[0]?.operationId);
			const removed = (yield* fleet.get("one")).value;
			expect(removed.stage).toBe("released");
			expect(removed.releaseReason).toContain("one");
			expect(removed.blocker).toBeUndefined();
			const releases = fleet
				.recordedSchedulerLogs()
				.filter((entry) => Array.isArray(entry.message) && entry.message.includes("Fleet released missing Board item"));
			expect(releases.map((entry) => entry.annotations)).toEqual([{ workId: "one" }]);
			const logs = fleet.recordedSchedulerLogs().length;
			yield* fleet.schedule();
			expect(fleet.recordedSchedulerLogs()).toHaveLength(logs);
		},
	);
}

fleetStory.it("direct dispatch ignores a deleted Board item queued ahead", [markdownAreas], function* (fleet) {
	yield* fleet.prepare("one");
	yield* fleet.prepare("two");
	yield* fleet.deleteBoardItem("one");
	expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value.stage).toBe("released");
});

fleetStory.it("deleting an idle area holder releases it during reconciliation", [githubBacklog, markdownAreas], function* (fleet) {
	yield* fleet.prepare("one");
	yield* fleet.dispatch("one");
	yield* fleet.finishWorker("one");
	expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
	yield* fleet.prepare("two");
	expect(yield* fleet.attemptDispatch("two")).toMatchObject({ _tag: "StorageAdmission" });
	yield* fleet.deleteBoardItem("one");
	yield* fleet.reconcile("one");
	expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
	expect((yield* fleet.get("one")).value.stage).toBe("released");
});

fleetStory.it("an ambiguous Board identity replaces stale blockers and logs each failed dispatch", [markdownAreas], function* (fleet) {
	yield* fleet.prepare("three");
	yield* fleet.dispatch("three");
	yield* fleet.prepare("one");
	yield* fleet.prepare("two");
	yield* fleet.schedule();
	expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area shared held by three");
	fleet.finishWorkers();
	yield* fleet.reconcile("three");
	yield* fleet.duplicateBoardItem("one");
	const before = fleet.recordedSchedulerLogs().length;
	yield* fleet.schedule();
	for (const id of ["one", "two"]) {
		const waiting = (yield* fleet.get(id)).value;
		expect(waiting.stage).toBe("prepared");
		expect(waiting.blocker).toContain("Board identity is missing or ambiguous: one");
		expect(waiting.blocker).not.toContain("held by");
	}
	const failures = fleet
		.recordedSchedulerLogs()
		.slice(before)
		.filter((entry) => Array.isArray(entry.message) && entry.message.includes("Fleet dispatch failed"));
	expect(failures.map((entry) => entry.annotations)).toEqual([{ workId: "one" }, { workId: "two" }]);
});
