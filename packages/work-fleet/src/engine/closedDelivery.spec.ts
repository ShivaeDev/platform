import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { executing } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest } from "#test/engineTraits.ts";
import { BASE, HEAD, MOVED, PR, REPORT } from "#test/githubResult.ts";

for (const scenario of ["conflicting", "moved"] as const) {
	engine.it(
		`closed Board work releases before recovering an open ${scenario} PR`,
		[githubPullRequest({})],
		function* ({
			fleet,
			prepareWork,
			workerReports,
			providerCalls,
			setBoardStatus,
			changePullRequestBase,
			conflictPullRequest,
			movePullRequestHead,
			acknowledgements,
			launches,
			reviewedHeads,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			const ready = yield* fleet.reconcile("one");
			expect(ready.value.step).toBe("waiting");
			expect(ready.value.review).toMatchObject({ head: HEAD, verdict: "approved" });
			expect(ready.value.checks).toMatchObject({ head: HEAD, passed: true });
			expect(executing(ready.value)).toBe(false);
			const published = ready.value.decision?.published ?? (yield* Effect.die("Missing ready decision"));
			const settings = providerCalls().length;
			setBoardStatus("one", "done");
			changePullRequestBase(MOVED);
			if (scenario === "conflicting") {
				conflictPullRequest();
			}
			movePullRequestHead(scenario === "moved" ? MOVED : HEAD);
			const released = yield* fleet.reconcile("one");
			expect(released.value.step).toBe("released");
			expect(released.value.releaseReason).toBe("Board status is done");
			expect(released.value.outcome).toBeUndefined();
			expect(released.value.decision).toBeUndefined();
			expect(released.value.result).toEqual(ready.value.result);
			expect(released.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published }]);
			expect(acknowledgements()).toContainEqual({ decision: published, disposition: "superseded", recordedAt: expect.any(Number) });
			expect(providerCalls()).toHaveLength(settings);
			expect(launches()).toHaveLength(2);
			expect(reviewedHeads()).toEqual([HEAD]);
			expect((yield* fleet.reconcile("one")).version).toBe(released.version);
		},
	);
}
for (const head of [HEAD, MOVED]) {
	engine.it(
		`closed Board work settles its ${head === HEAD ? "approved" : "unreviewed"} human merge before releasing for Board status`,
		[githubPullRequest({})],
		function* ({ fleet, prepareWork, workerReports, providerCalls, setBoardStatus, mergePullRequest, movePullRequestHead }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			yield* fleet.reconcile("one");
			const settings = providerCalls().length;
			setBoardStatus("one", "done");
			mergePullRequest();
			movePullRequestHead(head);
			const settled = yield* fleet.reconcile("one");
			expect(settled.value.step).toBe(head === HEAD ? "done" : "released");
			expect(settled.value.outcome).toEqual(head === HEAD ? { head: HEAD, revision: BASE, url: PR } : undefined);
			expect(settled.value.releaseReason).toBe(head === HEAD ? undefined : `PR #7 merged by a human at ${head}; Fleet review covered ${HEAD}`);
			expect(providerCalls()).toHaveLength(settings);
		},
	);
}
