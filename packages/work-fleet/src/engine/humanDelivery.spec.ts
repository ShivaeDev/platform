import { expect } from "@effect/vitest";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { backlog, executing } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { humanDeliveryWithoutReview, reviewedPullRequestIsOpen } from "#test/humanDeliveryScenarios.ts";

const result = { head: "reviewed-head", kind: "change", paths: ["src/one.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
const open = { headRefOid: result.head, mergeCommit: null, mergedAt: null, state: "OPEN", url: result.pr };
const merged = { ...open, mergeCommit: { oid: "merged-revision" }, mergedAt: "2026-01-01T00:00:00Z", state: "MERGED" };

{
	const setup = reviewedPullRequestIsOpen();
	engine.it(
		"green work never submits a merge and a restarted scheduler accepts the human merge once",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const ready = yield* fleet.reconcile("one");
			expect(ready.value.stage).toBe("needs-human");
			expect(ready.value.attentionOwner).toBe("orchestrator");
			expect(ready.value.decision?.attentionOwner).toBe("orchestrator");
			expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
			expect(ready.value.review?.head).toBe(result.head);
			expect(ready.value.checks).toMatchObject({ head: result.head, passed: true });
			expect(backlog(ready.value)).toBe(true);
			expect(executing(ready.value)).toBe(false);
			expect((yield* fleet.reconcile("one")).version).toBe(ready.version);
			context.observation = merged;
			yield* restart(cycle);
			const accepted = yield* fleet.get("one");
			expect(accepted.value.stage).toBe("completed");
			expect(accepted.value.outcome).toEqual({ head: result.head, revision: "merged-revision", url: result.pr });
			expect(backlog(accepted.value)).toBe(false);
			const completedViews = views((yield* fleet.list()).map(({ value }) => value));
			expect(completedViews.waiting).toEqual({ automation: [], maintainer: [], orchestrator: [] });
			expect(accepted.value.attentionOwner).toBeUndefined();
			expect(completedViews.completed[0]?.blocker).toBeUndefined();
			expect(completedViews.completed[0]?.decision).toBeUndefined();
			expect(accepted.value.decision?.published).toBeDefined();
			expect((yield* fleet.reconcile("one")).version).toBe(accepted.version);
			expect(fixture.launched).toHaveLength(2);
			expect(fixture.reviews).toHaveLength(1);
			expect(fixture.merged).toEqual([]);
		},
	);
}

{
	const setup = reviewedPullRequestIsOpen();
	engine.it(
		"a PR closed without merging replaces the ready decision with that fact",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			context.observation = { ...open, state: "CLOSED" };
			yield* restart(cycle);
			const closed = yield* fleet.get("one");
			expect(closed.value.stage).toBe("needs-human");
			expect(closed.value.decision?.reason).toContain("closed without merging");
			expect(closed.value.outcome).toBeUndefined();
			expect(backlog(closed.value)).toBe(true);
			expect((yield* fleet.reconcile("one")).version).toBe(closed.version);
			expect(fixture.merged).toEqual([]);
		},
	);
}

{
	const setup = reviewedPullRequestIsOpen();
	engine.it(
		"a human merge of a changed head cannot reuse the old review and checks",
		[setup.given],
		function* ({ fleet, prepareWork, finishWorkers }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			context.observation = { ...merged, headRefOid: "unreviewed-head" };
			const blocked = yield* fleet.reconcile("one");
			expect(blocked.value.stage).toBe("released");
			expect(blocked.value.releaseReason).toBe("PR #42 merged by a human at unreviewed-head; Fleet review covered reviewed-head");
			expect(blocked.value.outcome).toBeUndefined();
			expect(backlog(blocked.value)).toBe(false);
		},
	);
}

for (const state of ["CLOSED", "MERGED"] as const) {
	{
		const setup = humanDeliveryWithoutReview(state);
		engine.it(`observes ${state} without accepting unreviewed work`, [setup.given], function* ({ fixture, fleet, prepareWork, finishWorkers }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const waiting = yield* fleet.reconcile("one");
			yield* fixture.replaceRecord({ ...waiting.value, attempts: waiting.value.attempts.map((attempt) => ({ ...attempt, status: "completed" })) });
			const observed = yield* fleet.reconcile("one");
			expect(observed.value.stage).toBe(state === "CLOSED" ? "needs-human" : "released");
			if (state === "CLOSED") {
				expect(observed.value.decision?.reason).toContain("closed without merging");
			} else {
				expect(observed.value.releaseReason).toBe("PR #42 merged by a human at reviewed-head; Fleet review covered nothing");
			}
			expect(observed.value.outcome).toBeUndefined();
			expect(backlog(observed.value)).toBe(state === "CLOSED");
		});
	}
}
