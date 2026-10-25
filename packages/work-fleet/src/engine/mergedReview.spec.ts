import { expect } from "@effect/vitest";
import { backlog } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { HEAD, MOVED, PR, REPORT } from "#test/githubResult.ts";

for (const head of [HEAD, MOVED]) {
	for (const pending of [false, true]) {
		engine.it(
			`a human merge at ${head} during review releases once the reviewer is terminal with ${pending ? "pending" : "green"} checks`,
			[githubPullRequest({}), reviewerStillRunning()],
			function* ({
				fleet,
				finishWorkers,
				prepareWork,
				workerReports,
				mergePullRequest,
				movePullRequestHead,
				checksRemainPending,
				launches,
				reviewedHeads,
				mergedHeads,
				githubRequests,
			}) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				workerReports(REPORT);
				const reviewing = yield* fleet.reconcile("one");
				expect(reviewing.value.step).toBe("reviewing");
				expect(reviewing.value.result).toMatchObject({ head: HEAD, pr: PR, prNumber: 7 });
				mergePullRequest();
				movePullRequestHead(head);
				checksRemainPending(pending);
				expect((yield* fleet.reconcile("one")).value.step).toBe("reviewing");
				finishWorkers();
				const observed = yield* fleet.reconcile("one");
				expect(observed.value.step).toBe("released");
				expect(observed.value.releaseReason).toBe(`PR #7 merged by a human at ${head}; Fleet review covered nothing`);
				expect(observed.value.outcome).toBeUndefined();
				expect(observed.value.review).toBeUndefined();
				expect(observed.value.checks).toBeUndefined();
				expect(observed.value.result).toEqual(reviewing.value.result);
				expect(backlog(observed.value)).toBe(false);
				expect((yield* fleet.reconcile("one")).version).toBe(observed.version);
				expect(launches()).toEqual(["operation-1", "operation-2"]);
				expect(reviewedHeads()).toEqual([HEAD]);
				expect(mergedHeads()).toEqual([]);
				expect(githubRequests().filter((request) => request === "/repos/example/repository/pulls/7").length).toBeGreaterThan(2);
			},
		);
	}
}
for (const scenario of [
	{
		head: HEAD,
		name: "closure without merge",
		reason: "Reported PR must be open or merged and target the configured repository branch",
		status: "CLOSED",
	},
] as const) {
	engine.it(
		`${scenario.name} during review retains ownership and waits on the orchestrator`,
		[githubPullRequest({}), reviewerStillRunning()],
		function* ({ fleet, finishWorkers, prepareWork, workerReports, closePullRequest, movePullRequestHead, launches, reviewedHeads, mergedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			const reviewing = yield* fleet.reconcile("one");
			expect(reviewing.value.step).toBe("reviewing");
			expect(reviewing.value.result).toMatchObject({ head: HEAD, pr: PR, prNumber: 7 });
			closePullRequest();
			movePullRequestHead(scenario.head);
			finishWorkers();
			const observed = yield* fleet.reconcile("one");
			expect(observed.value.step).toBe("waiting");
			expect(observed.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
			expect(observed.value.decision?.reason).toContain(scenario.reason);
			expect(observed.value.outcome).toBeUndefined();
			expect(backlog(observed.value)).toBe(true);
			expect(observed.value.result).toEqual(reviewing.value.result);
			expect(launches()).toEqual(["operation-1", "operation-2"]);
			expect(reviewedHeads()).toEqual([HEAD]);
			expect(mergedHeads()).toEqual([]);
		},
	);
}
