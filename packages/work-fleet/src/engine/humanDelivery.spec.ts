import { expect } from "@effect/vitest";
import { views } from "#engine/views.ts";
import { backlog, executing } from "#model.ts";
import { humanDeliveryWithoutReview, reviewedPullRequestIsOpen } from "#test/engineDeliveryTraits.ts";
import { engine } from "#test/engineStory.ts";

const result = { head: "reviewed-head", kind: "change", paths: ["src/one.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
engine.it(
	"green work never submits a merge and a restarted scheduler accepts the human merge once",
	[reviewedPullRequestIsOpen()],
	function* ({ fleet, prepareWork, finishWorkers, restart, mergePullRequest, schedule, launches, reviewedHeads, mergedHeads }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const ready = yield* fleet.reconcile("one");
		expect(ready.value.step).toBe("waiting");
		expect(ready.value.attentionOwner).toBe("orchestrator");
		expect(ready.value.decision?.attentionOwner).toBe("orchestrator");
		expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
		expect(ready.value.review?.head).toBe(result.head);
		expect(ready.value.checks).toMatchObject({ head: result.head, passed: true });
		expect(backlog(ready.value)).toBe(true);
		expect(executing(ready.value)).toBe(false);
		expect((yield* fleet.reconcile("one")).version).toBe(ready.version);
		mergePullRequest();
		yield* restart();
		yield* schedule();
		const accepted = yield* fleet.get("one");
		expect(accepted.value.step).toBe("done");
		expect(accepted.value.outcome).toEqual({ head: result.head, revision: "merged-revision", url: result.pr });
		expect(backlog(accepted.value)).toBe(false);
		const completedViews = views((yield* fleet.list()).map(({ value }) => value));
		expect(completedViews.waiting).toEqual({ automation: [], maintainer: [], orchestrator: [] });
		expect(accepted.value.attentionOwner).toBeUndefined();
		expect(completedViews.completed[0]?.blocker).toBeUndefined();
		expect(completedViews.completed[0]?.decision).toBeUndefined();
		expect(accepted.value.decision?.published).toBeDefined();
		expect((yield* fleet.reconcile("one")).version).toBe(accepted.version);
		expect(launches()).toEqual(["operation-1", "operation-2"]);
		expect(reviewedHeads()).toEqual([result.head]);
		expect(mergedHeads()).toEqual([]);
	},
);
engine.it(
	"a PR closed without merging replaces the ready decision with that fact",
	[reviewedPullRequestIsOpen()],
	function* ({ fleet, prepareWork, finishWorkers, restart, closePullRequest, schedule, mergedHeads }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		closePullRequest();
		yield* restart();
		yield* schedule();
		const closed = yield* fleet.get("one");
		expect(closed.value.step).toBe("waiting");
		expect(closed.value.decision?.reason).toContain("closed without merging");
		expect(closed.value.outcome).toBeUndefined();
		expect(backlog(closed.value)).toBe(true);
		expect((yield* fleet.reconcile("one")).version).toBe(closed.version);
		expect(mergedHeads()).toEqual([]);
	},
);
engine.it(
	"a human merge of a changed head cannot reuse the old review and checks",
	[reviewedPullRequestIsOpen()],
	function* ({ fleet, prepareWork, finishWorkers, mergePullRequest }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		mergePullRequest("unreviewed-head");
		const blocked = yield* fleet.reconcile("one");
		expect(blocked.value.step).toBe("released");
		expect(blocked.value.releaseReason).toBe("PR #42 merged by a human at unreviewed-head; Fleet review covered reviewed-head");
		expect(blocked.value.outcome).toBeUndefined();
		expect(backlog(blocked.value)).toBe(false);
	},
);
for (const state of ["CLOSED", "MERGED"] as const) {
	engine.it(
		`observes ${state} without accepting unreviewed work`,
		[humanDeliveryWithoutReview(state)],
		function* ({ fleet, prepareWork, finishWorkers, replaceStoredRecord }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const waiting = yield* fleet.reconcile("one");
			yield* replaceStoredRecord({ ...waiting.value, attempts: waiting.value.attempts.map((attempt) => ({ ...attempt, status: "completed" })) });
			const observed = yield* fleet.reconcile("one");
			expect(observed.value.step).toBe(state === "CLOSED" ? "waiting" : "released");
			if (state === "CLOSED") {
				expect(observed.value.decision?.reason).toContain("closed without merging");
			} else {
				expect(observed.value.releaseReason).toBe("PR #42 merged by a human at reviewed-head; Fleet review covered nothing");
			}
			expect(observed.value.outcome).toBeUndefined();
			expect(backlog(observed.value)).toBe(state === "CLOSED");
		},
	);
}
