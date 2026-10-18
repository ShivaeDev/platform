import { expect } from "@effect/vitest";
import { backlog } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { HEAD, MOVED } from "#test/githubResult.ts";

for (const head of [HEAD, MOVED]) {
	for (const pending of [false, true]) {
		engine.it(
			`a human merge at ${head} during review releases once the reviewer is terminal with ${pending ? "pending" : "green"} checks`,
			[githubPullRequest({}), reviewerStillRunning()],
			function* ({ fixture, fleet, finishWorkers, pullRequest, startReview }) {
				const github = pullRequest();
				const reviewing = yield* startReview();
				github.state.status = "MERGED";
				github.state.head = head;
				github.state.pending = pending;
				expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
				finishWorkers();
				const observed = yield* fleet.reconcile("one");
				expect(observed.value.stage).toBe("released");
				expect(observed.value.releaseReason).toBe(`PR #7 merged by a human at ${head}; Fleet review covered nothing`);
				expect(observed.value.outcome).toBeUndefined();
				expect(observed.value.review).toBeUndefined();
				expect(observed.value.checks).toBeUndefined();
				expect(observed.value.result).toEqual(reviewing.value.result);
				expect(backlog(observed.value)).toBe(false);
				expect((yield* fleet.reconcile("one")).version).toBe(observed.version);
				expect(fixture.launched).toHaveLength(2);
				expect(fixture.reviews).toEqual([HEAD]);
				expect(fixture.merged).toEqual([]);
				expect(github.requests.filter((request) => request === "/repos/example/repository/pulls/7").length).toBeGreaterThan(2);
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
		function* ({ fixture, fleet, finishWorkers, pullRequest, startReview }) {
			const github = pullRequest();
			const reviewing = yield* startReview();
			github.state.status = scenario.status;
			github.state.head = scenario.head;
			finishWorkers();
			const observed = yield* fleet.reconcile("one");
			expect(observed.value.stage).toBe("needs-human");
			expect(observed.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
			expect(observed.value.decision?.reason).toContain(scenario.reason);
			expect(observed.value.outcome).toBeUndefined();
			expect(backlog(observed.value)).toBe(true);
			expect(observed.value.result).toEqual(reviewing.value.result);
			expect(fixture.launched).toHaveLength(2);
			expect(fixture.reviews).toEqual([HEAD]);
			expect(fixture.merged).toEqual([]);
		},
	);
}
