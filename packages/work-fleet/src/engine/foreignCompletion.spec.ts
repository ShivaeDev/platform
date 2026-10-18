import { expect } from "vitest";
import { fleetStory, githubBacklog, singlePrBacklog } from "#test/fleetStory.ts";
import { PR } from "#test/githubResult.ts";

fleetStory.it("a closed PR releases its foreign backlog once and waiting work launches", [githubBacklog], function* (fleet) {
	yield* fleet.prepare("one");
	yield* fleet.dispatch("one");
	yield* fleet.finishWorker("one");
	expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
	yield* fleet.reservePr();
	yield* fleet.prepare("two");
	expect(yield* fleet.attemptDispatch("two")).toMatchObject({ kind: "backlog" });
	expect((yield* fleet.get("two")).value.stage).toBe("prepared");
	yield* fleet.reconcile("one");
	expect(yield* fleet.reservations()).toEqual([{ backlog: true, executing: false, owner: PR }]);
	fleet.closePrOnGithub();
	const closed = yield* fleet.reconcile("one");
	expect(closed.value).toMatchObject({ decision: { code: "pr-closed" }, stage: "needs-human" });
	expect(closed.value.outcome).toBeUndefined();
	expect(yield* fleet.reservations()).toEqual([]);
	expect(fleet.commits).toContainEqual(["fleet"]);
	const commits = fleet.commits.length;
	expect((yield* fleet.reconcile("one")).version).toBe(closed.version);
	expect(fleet.commits).toHaveLength(commits);
	const launches = fleet.launched.length;
	yield* fleet.schedule();
	expect((yield* fleet.get("two")).value.stage).toBe("executing");
	expect(fleet.launched).toHaveLength(launches + 1);
});

fleetStory.it("a merged PR releases its foreign backlog and waiting work launches", [githubBacklog], function* (fleet) {
	yield* fleet.prepare("one");
	yield* fleet.dispatch("one");
	yield* fleet.finishWorker("one");
	expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
	yield* fleet.reservePr();
	yield* fleet.prepare("two");
	expect(yield* fleet.attemptDispatch("two")).toMatchObject({ kind: "backlog" });
	expect((yield* fleet.get("two")).value.stage).toBe("prepared");
	yield* fleet.reconcile("one");
	expect(yield* fleet.reservations()).toEqual([{ backlog: true, executing: false, owner: PR }]);
	fleet.mergePrOnGithub();
	expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
	expect(yield* fleet.reservations()).toEqual([]);
	const launches = fleet.launched.length;
	yield* fleet.schedule();
	expect((yield* fleet.get("two")).value.stage).toBe("executing");
	expect(fleet.launched).toHaveLength(launches + 1);
});

fleetStory.it(
	"releasing a closure decision keeps the foreign reservation absent and launches waiting work",
	[githubBacklog, singlePrBacklog],
	function* (fleet) {
		yield* fleet.prepare("one");
		yield* fleet.dispatch("one");
		yield* fleet.finishWorker("one");
		expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
		yield* fleet.reservePr();
		yield* fleet.prepare("two");
		expect(yield* fleet.attemptDispatch("two")).toMatchObject({ kind: "backlog" });
		fleet.closePrOnGithub();
		expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("pr-closed");
		expect(yield* fleet.reservations()).toEqual([]);
		expect(yield* fleet.attemptDispatch("two")).toMatchObject({ kind: "backlog" });
		expect((yield* fleet.answerDecision("one", "release")).value.stage).toBe("released");
		expect((yield* fleet.reconcile("one")).value.stage).toBe("released");
		expect((yield* fleet.get("one")).value.mergedDelivery).toBeUndefined();
		expect(yield* fleet.reservations()).toEqual([]);
		const launches = fleet.launched.length;
		yield* fleet.schedule();
		expect((yield* fleet.get("two")).value.stage).toBe("executing");
		expect(fleet.launched).toHaveLength(launches + 1);
		expect((yield* fleet.get("one")).value.mergedDelivery).toBeUndefined();
		expect(yield* fleet.reservations()).toEqual([]);
	},
);

fleetStory.it("releasing work whose PR is still open retains its foreign backlog owner", [githubBacklog], function* (fleet) {
	yield* fleet.prepare("one");
	yield* fleet.dispatch("one");
	yield* fleet.finishWorker("one");
	expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("reviewed-pr-ready");
	expect(yield* fleet.reservations()).toEqual([]);
	expect((yield* fleet.answerDecision("one", "release")).value.stage).toBe("released");
	yield* fleet.reconcile("one");
	expect(yield* fleet.reservations()).toEqual([{ backlog: true, executing: false, owner: PR }]);
});
