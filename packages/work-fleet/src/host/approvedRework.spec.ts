import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { answers, approvedPullRequest } from "#test/answerHost.ts";
import { repairAttempts, reviewHeads } from "#test/approvedPrDaemon.ts";
import { BASE, HEAD, MOVED } from "#test/githubResult.ts";

for (const conflicting of [false, true]) {
	answers.it(`daemon reconciliation consumes retry text when conflict=${conflicting}`, [approvedPullRequest], function* (daemon) {
		const ready = yield* daemon.readyPullRequest();
		const response = daemon.publishPullRequestResponse(ready, "Keep the loading indicator visible.");
		if (conflicting) {
			daemon.setMergeable("CONFLICTING");
		}
		yield* daemon.request("fleet.reconcile", { workId: "one" });
		const repaired = yield* daemon.workerStarted("repair");
		expect(repaired.step).toBe("working");
		expect(repaired.attempts.at(-1)?.prompt).toContain("Keep the loading indicator visible.");
		expect(repaired.attempts.at(-1)?.receipt?.sessionId).toBe(ready.attempts[0]?.receipt?.sessionId);
		expect(repaired.responses?.at(-1)).toMatchObject({ boardAcknowledged: true, responseId: response.responseId });
		expect(repairAttempts(repaired)).toMatchObject([{ prompt: expect.stringContaining("Keep the loading indicator visible."), role: "repair" }]);
		if (conflicting) {
			expect(repaired.conflictRepairs).toEqual([BASE]);
			expect(repaired.attempts.at(-1)?.prompt).toContain("Fetch and merge main once");
		}
	});
}

for (const author of ["maintainer", "orchestrator"]) {
	answers.it(
		`daemon sends ${author} retry text to the same worker and reviews its new PR head after restart`,
		[approvedPullRequest],
		function* (daemon) {
			const resolved = yield* Effect.gen(function* () {
				let ready = yield* daemon.readyPullRequest();
				expect(ready.decision?.reason).toBe("Reviewed PR is ready to merge");
				if (author === "orchestrator" && ready.decision !== undefined) {
					ready = yield* daemon.request("fleet.reassign", { attentionOwner: "orchestrator", decisionId: ready.decision.id, workId: "one" });
				}
				const response = daemon.publishPullRequestResponse(ready, "Preserve the empty state and add its regression test.", author);
				const queued = yield* daemon.request("fleet.resolve", response);
				expect(queued.step).toBe("repairing");
				expect(queued.prompt).toContain("Preserve the empty state and add its regression test.");
				expect(queued.checks).toBeUndefined();
				expect(queued.review).toBeUndefined();
				expect(queued.mergeReadyHead).toBeUndefined();
				expect(queued.responses?.at(-1)).toMatchObject({ boardAcknowledged: true, responseId: response.responseId });
				return { ready, response };
			});
			yield* Effect.gen(function* () {
				yield* daemon.stop();
				yield* daemon.start();
				yield* daemon.request("fleet.reconcile", { workId: "one" });
				const launched = yield* daemon.workerStarted("repair");
				const repair = launched.attempts.at(-1);
				expect(launched.step).toBe("working");
				expect(repair?.role).toBe("repair");
				expect(repair?.receipt?.sessionId).toBe(resolved.ready.attempts[0]?.receipt?.sessionId);
				expect(repair?.prompt).toContain("Preserve the empty state and add its regression test.");
				expect(repair?.prompt).toContain(`same branch and PR (${daemon.pullRequestUrl()})`);
				expect(daemon.providerObservation(repair?.receipt?.turnId ?? "")?.output).toBe(repair?.prompt);
				expect((yield* daemon.request("fleet.resolve", resolved.response)).attempts).toEqual(launched.attempts);
				daemon.finishPullRequestTurn(launched, MOVED);
				const reviewed = yield* daemon.request("fleet.reconcile", { workId: "one" });
				expect(reviewed.step).toBe("waiting");
				expect(reviewed.result).toMatchObject({ head: MOVED, pr: daemon.pullRequestUrl() });
				expect(reviewed.review).toMatchObject({ head: MOVED, verdict: "approved" });
				expect(reviewed.checks).toMatchObject({ head: MOVED, passed: true });
				expect(reviewHeads(reviewed)).toEqual([HEAD, MOVED]);
				expect(repairAttempts(reviewed).map(({ operationId }) => operationId)).toEqual([repair?.operationId]);
			});
		},
	);
}

answers.it("daemon retries an unchanged approved head without text by republishing merge readiness", [approvedPullRequest], function* (daemon) {
	let ready = yield* daemon.readyPullRequest();
	for (const body of ["", "  \n  "]) {
		daemon.publishPullRequestResponse(ready, body);
		const retried = yield* daemon.request("fleet.reconcile", { workId: "one" });
		expect(retried.decision?.reason).toBe("Reviewed PR is ready to merge");
		expect(retried.decision?.id).not.toBe(ready.decision?.id);
		expect(retried.result).toEqual(ready.result);
		expect(retried.review).toEqual(ready.review);
		expect(retried.checks).toEqual(ready.checks);
		expect(retried.attempts).toEqual(ready.attempts);
		expect(daemon.launchedSessions()).toEqual(ready.attempts.map(({ operationId }) => operationId));
		ready = retried;
	}
});

answers.it("answer text queues requested changes on the same branch and PR through daemon HTTP", [approvedPullRequest], function* (daemon) {
	const ready = yield* daemon.readyPullRequest();
	const queued = yield* daemon.answerAndWait("Keep the loading indicator visible.");
	expect(queued.step).toBe("repairing");
	expect(queued.responses?.at(-1)).toMatchObject({ action: "retry", boardAcknowledged: true });
	yield* daemon.request("fleet.reconcile", { workId: "one" });
	const reworked = yield* daemon.workerStarted("repair");
	expect(reworked.result).toEqual(ready.result);
	expect(reworked.attempts.at(-1)?.receipt?.sessionId).toBe(ready.attempts[0]?.receipt?.sessionId);
	expect(reworked.attempts.at(-1)?.prompt).toContain("Keep the loading indicator visible.");
	expect(reworked.attempts.at(-1)?.prompt).toContain(`same branch and PR (${daemon.pullRequestUrl()})`);
});

answers.it("answer without text retries a ready PR without requesting rework", [approvedPullRequest], function* (daemon) {
	const ready = yield* daemon.readyPullRequest();
	const retried = yield* daemon.answerAndWait();
	expect(retried.step).toBe("delivering");
	const waiting = yield* daemon.request("fleet.reconcile", { workId: "one" });
	expect(waiting.decision?.code).toBe("reviewed-pr-ready");
	expect(waiting.attempts).toEqual(ready.attempts);
	expect(repairAttempts(waiting)).toHaveLength(0);
});
