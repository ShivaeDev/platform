import { expect } from "vitest";
import { githubBacklog, singlePrBacklog } from "#test/engineSchedulingTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { PR } from "#test/githubResult.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

isolatedEngine.it("a closed PR releases its foreign backlog once and waiting work launches", [githubBacklog], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.finishWorker("one");
	expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
	yield* fleet.reservePr();
	yield* fleet.prepareWork("two");
	expect(yield* fleet.attemptDispatch("two")).toMatchObject({ kind: "backlog" });
	expect((yield* fleet.get("two")).value.step).toBe("queued");
	yield* fleet.reconcile("one");
	expect(yield* fleet.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: PR }]);
	const beforeClose = fleet.commitBatches().length;
	fleet.closePullRequest();
	const closed = yield* fleet.reconcile("one");
	expect(closed.value).toMatchObject({ decision: { code: "pr-closed" }, step: "waiting" });
	expect(closed.value.outcome).toBeUndefined();
	expect(yield* fleet.foreignReservations()).toEqual([]);
	const reservations = `${STORAGE_NAMESPACE}_foreign_reservations`;
	expect(fleet.commitBatches()[beforeClose]?.toSorted()).toEqual(["fleet", reservations, `${reservations}:${PR}`].toSorted());
	const commits = fleet.commitBatches().length;
	expect((yield* fleet.reconcile("one")).version).toBe(closed.version);
	expect(fleet.commitBatches()).toHaveLength(commits);
	const launches = fleet.launches().length;
	yield* fleet.schedule();
	expect((yield* fleet.get("two")).value.step).toBe("working");
	expect(fleet.launches()).toHaveLength(launches + 1);
});

isolatedEngine.it("a merged PR releases its foreign backlog and waiting work launches", [githubBacklog], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.finishWorker("one");
	expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
	yield* fleet.reservePr();
	yield* fleet.prepareWork("two");
	expect(yield* fleet.attemptDispatch("two")).toMatchObject({ kind: "backlog" });
	expect((yield* fleet.get("two")).value.step).toBe("queued");
	yield* fleet.reconcile("one");
	expect(yield* fleet.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: PR }]);
	fleet.mergePullRequest();
	expect((yield* fleet.reconcile("one")).value.step).toBe("done");
	expect(yield* fleet.foreignReservations()).toEqual([]);
	const launches = fleet.launches().length;
	yield* fleet.schedule();
	expect((yield* fleet.get("two")).value.step).toBe("working");
	expect(fleet.launches()).toHaveLength(launches + 1);
});

isolatedEngine.it(
	"releasing a closure decision keeps the foreign reservation absent and launches waiting work",
	[githubBacklog, singlePrBacklog],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.finishWorker("one");
		expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
		yield* fleet.reservePr();
		yield* fleet.prepareWork("two");
		expect(yield* fleet.attemptDispatch("two")).toMatchObject({ kind: "backlog" });
		fleet.closePullRequest();
		expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("pr-closed");
		expect(yield* fleet.foreignReservations()).toEqual([]);
		expect(yield* fleet.attemptDispatch("two")).toMatchObject({ kind: "backlog" });
		expect((yield* fleet.answerDecision("one", "release")).value.step).toBe("released");
		expect((yield* fleet.reconcile("one")).value.step).toBe("released");
		expect((yield* fleet.get("one")).value.mergedDelivery).toBeUndefined();
		expect(yield* fleet.foreignReservations()).toEqual([]);
		const launches = fleet.launches().length;
		yield* fleet.schedule();
		expect((yield* fleet.get("two")).value.step).toBe("working");
		expect(fleet.launches()).toHaveLength(launches + 1);
		expect((yield* fleet.get("one")).value.mergedDelivery).toBeUndefined();
		expect(yield* fleet.foreignReservations()).toEqual([]);
	},
);

isolatedEngine.it("releasing work whose PR is still open retains its foreign backlog owner", [githubBacklog], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.finishWorker("one");
	expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("reviewed-pr-ready");
	expect(yield* fleet.foreignReservations()).toEqual([]);
	expect((yield* fleet.answerDecision("one", "release")).value.step).toBe("released");
	yield* fleet.reconcile("one");
	expect(yield* fleet.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: PR }]);
});
