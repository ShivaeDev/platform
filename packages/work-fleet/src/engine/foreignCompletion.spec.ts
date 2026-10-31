import { Order } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { githubBacklog, singlePrBacklog } from "#test/engineSchedulingTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { PR } from "#test/githubResult.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

const BACKLOG_FULL = /^backlog capacity of \d+ is full$/u;
const PR_BACKLOG = [{ areas: [], backlog: true, executing: false, owner: PR }];
const RESERVATIONS = `${STORAGE_NAMESPACE}_foreign_reservations`;

isolatedEngine.it(
	"closing a PR releases its foreign backlog in one commit, a repeated reconcile commits nothing, and waiting work launches",
	[githubBacklog],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.finishWorker("one");
		expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
		yield* fleet.reservePr();
		yield* fleet.prepareWork("two");
		yield* fleet.reconcile("one");
		yield* outcomes([
			["dispatching two", () => fleet.attemptDispatch("two"), expect.stringMatching(BACKLOG_FULL)],
			["foreign reservations", () => fleet.foreignReservations(), PR_BACKLOG],
		]);
		const beforeClose = fleet.commitBatches().length;
		fleet.closePullRequest();

		const closed = yield* fleet.reconcile("one");

		expect(closed.value).toMatchObject({ decision: { code: "pr-closed" }, step: "waiting" });
		expect(closed.value.outcome).toBeUndefined();
		expect(fleet.commitBatches()[beforeClose]?.toSorted(Order.mapInput(Order.String, String))).toEqual(
			["fleet", RESERVATIONS, `${RESERVATIONS}:${PR}`].toSorted(Order.String),
		);
		const commits = fleet.commitBatches().length;
		expect((yield* fleet.reconcile("one")).version).toBe(closed.version);
		expect(fleet.commitBatches()).toHaveLength(commits);
		const launches = yield* fleet.launchCount();
		yield* fleet.schedule();
		yield* outcomes([
			["foreign reservations", () => fleet.foreignReservations(), []],
			["two", () => fleet.stepOf("two"), "working"],
			["launches", () => fleet.launchCount(), launches + 1],
		]);
	},
);

isolatedEngine.it("merging a PR releases its foreign backlog so waiting work launches", [githubBacklog], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.finishWorker("one");
	expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
	yield* fleet.reservePr();
	yield* fleet.prepareWork("two");
	yield* fleet.reconcile("one");
	yield* outcomes([
		["dispatching two", () => fleet.attemptDispatch("two"), expect.stringMatching(BACKLOG_FULL)],
		["foreign reservations", () => fleet.foreignReservations(), PR_BACKLOG],
	]);
	fleet.mergePullRequest();

	expect((yield* fleet.reconcile("one")).value.step).toBe("done");

	const launches = yield* fleet.launchCount();
	yield* fleet.schedule();
	yield* outcomes([
		["foreign reservations", () => fleet.foreignReservations(), []],
		["two", () => fleet.stepOf("two"), "working"],
		["launches", () => fleet.launchCount(), launches + 1],
	]);
});

isolatedEngine.it(
	"releasing a closed PR's decision keeps its foreign reservation absent, records no merged delivery and launches waiting work",
	[githubBacklog, singlePrBacklog],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.finishWorker("one");
		expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
		yield* fleet.reservePr();
		yield* fleet.prepareWork("two");
		expect(yield* fleet.attemptDispatch("two")).toMatch(BACKLOG_FULL);
		fleet.closePullRequest();
		expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("pr-closed");
		yield* outcomes([
			["foreign reservations", () => fleet.foreignReservations(), []],
			["dispatching two", () => fleet.attemptDispatch("two"), expect.stringMatching(BACKLOG_FULL)],
		]);

		yield* fleet.answerDecision("one", "release");

		expect((yield* fleet.reconcile("one")).value.step).toBe("released");
		const launches = yield* fleet.launchCount();
		yield* fleet.schedule();
		yield* outcomes([
			["two", () => fleet.stepOf("two"), "working"],
			["launches", () => fleet.launchCount(), launches + 1],
			["one", () => fleet.mergedDeliveryOf("one"), "no merged delivery"],
			["foreign reservations", () => fleet.foreignReservations(), []],
		]);
	},
);

isolatedEngine.it("releasing work whose PR is still open takes over its foreign backlog", [githubBacklog], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	yield* fleet.finishWorker("one");
	const reconciled = yield* fleet.reconcile("one");
	expect(reconciled.value.decision?.code).toBe("reviewed-pr-ready");
	expect(yield* fleet.foreignReservations()).toEqual([]);

	yield* fleet.answerDecision("one", "release");
	yield* fleet.reconcile("one");

	expect(yield* fleet.foreignReservations()).toEqual(PR_BACKLOG);
});
