import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CONFLICTING_PR_REASON } from "#engine/deliveryFailure.ts";
import { answers, approvedPullRequest } from "#test/answerHost.ts";
import { repairAttempts } from "#test/approvedPrDaemon.ts";
import { BASE, MOVED } from "#test/githubResult.ts";

answers.it("daemon relaunches a conflicting approved PR once per main revision across restart", [approvedPullRequest], function* (daemon) {
	const initial = yield* Effect.gen(function* () {
		const ready = yield* daemon.readyPullRequest();
		daemon.setMergeable("CONFLICTING");
		yield* daemon.request("fleet.reconcile", { workId: "one" });
		const repair = yield* daemon.workerStarted("repair");
		expect(repair.step).toBe("working");
		expect(repair.conflictRepairs).toEqual([BASE]);
		expect(repair.review).toBeUndefined();
		expect(repair.checks).toBeUndefined();
		expect(repair.mergeReadyHead).toBeUndefined();
		expect(repair.attempts.at(-1)?.role).toBe("repair");
		expect(repair.attempts.at(-1)?.receipt?.sessionId).toBe(ready.attempts[0]?.receipt?.sessionId);
		expect(repair.attempts.at(-1)?.prompt).toContain("Fetch and merge main once");
		expect(repair.attempts.at(-1)?.prompt).toContain(BASE);
		expect(repair.supersededDecisions?.at(-1)).toMatchObject({ boardAcknowledged: true, published: ready.decision?.published });
		return repair;
	});
	yield* Effect.gen(function* () {
		yield* daemon.stop();
		yield* daemon.start();
		const resumed = yield* daemon.request("fleet.reconcile", { workId: "one" });
		expect(resumed.attempts).toHaveLength(initial.attempts.length);
		expect(resumed.attempts.at(-1)?.operationId).toBe(initial.attempts.at(-1)?.operationId);
		daemon.finishPullRequestTurn(initial, MOVED);
		const stillConflicting = yield* daemon.request("fleet.reconcile", { workId: "one" });
		expect(stillConflicting.decision?.reason).toBe(CONFLICTING_PR_REASON);
		expect(repairAttempts(stillConflicting).map(({ operationId }) => operationId)).toEqual(
			repairAttempts(initial).map(({ operationId }) => operationId),
		);
		expect((yield* daemon.request("fleet.reconcile", { workId: "one" })).attempts).toEqual(stillConflicting.attempts);
		daemon.movePullRequestBase("d".repeat(40));
		yield* daemon.request("fleet.reconcile", { workId: "one" });
		const next = yield* daemon.workerStarted("repair");
		expect(next.step).toBe("working");
		expect(next.conflictRepairs).toEqual([BASE, daemon.pullRequestBase()]);
		expect(repairAttempts(next)).toMatchObject([
			...repairAttempts(stillConflicting),
			{ prompt: expect.stringContaining(daemon.pullRequestBase()), role: "repair" },
		]);
		expect(next.attempts.at(-1)?.prompt).toContain(daemon.pullRequestBase());
		daemon.setMergeable("MERGEABLE");
		daemon.finishPullRequestTurn(next, "e".repeat(40));
		const ready = yield* daemon.request("fleet.reconcile", { workId: "one" });
		expect(ready.decision?.reason).toBe("Reviewed PR is ready to merge");
		expect(ready.review).toMatchObject({ head: daemon.pullRequestHead(), verdict: "approved" });
		expect(ready.checks).toMatchObject({ head: daemon.pullRequestHead(), passed: true });
		expect(repairAttempts(ready).map(({ operationId }) => operationId)).toEqual(repairAttempts(next).map(({ operationId }) => operationId));
	});
});

answers.it(
	"daemon preserves approval when GitHub reports a mergeable or unknown head behind a moving main",
	[approvedPullRequest],
	function* (daemon) {
		const ready = yield* daemon.readyPullRequest();
		for (const mergeable of ["MERGEABLE", "UNKNOWN"] as const) {
			daemon.setMergeable(mergeable);
			daemon.movePullRequestBase(MOVED);
			const waiting = yield* daemon.request("fleet.reconcile", { workId: "one" });
			expect(waiting).toEqual(ready);
		}
		expect(daemon.launchedSessions()).toEqual(ready.attempts.map(({ operationId }) => operationId));
	},
);
