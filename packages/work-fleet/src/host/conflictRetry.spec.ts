import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CONFLICTING_PR_REASON } from "#engine/deliveryFailure.ts";
import { answers, approvedPullRequest } from "#test/answerHost.ts";
import { repairAttempts, reviewHeads } from "#test/approvedPrDaemon.ts";
import { HEAD, MOVED } from "#test/githubResult.ts";

for (const body of ["", "Preserve the loading indicator."]) {
	answers.it(`conflict retry repairs the existing PR before reviewing again with text=${body !== ""}`, [approvedPullRequest], function* (daemon) {
		const resolved = yield* Effect.gen(function* () {
			yield* daemon.readyPullRequest();
			daemon.setMergeable("CONFLICTING");
			yield* daemon.request("fleet.reconcile", { workId: "one" });
			const automatic = yield* daemon.workerStarted("repair");
			daemon.finishPullRequestTurn(automatic);
			const blocked = yield* daemon.request("fleet.reconcile", { workId: "one" });
			expect(blocked.decision?.reason).toBe(CONFLICTING_PR_REASON);
			const response = daemon.publishPullRequestResponse(blocked, body, "orchestrator");
			const queued = yield* daemon.request("fleet.resolve", response);
			expect(queued.step).toBe("repairing");
			expect(queued.review).toBeUndefined();
			expect(queued.checks).toBeUndefined();
			expect(queued.responses?.at(-1)).toMatchObject({ boardAcknowledged: true, responseId: response.responseId });
			return { blocked, response };
		});
		yield* Effect.gen(function* () {
			yield* daemon.stop();
			yield* daemon.start();
			yield* daemon.request("fleet.reconcile", { workId: "one" });
			const launched = yield* daemon.workerStarted("repair");
			const repair = launched.attempts.at(-1);
			expect(repairAttempts(launched)).toMatchObject([
				...repairAttempts(resolved.blocked),
				{ prompt: expect.stringContaining("Fetch and merge main"), role: "repair" },
			]);
			expect(repair?.receipt?.sessionId).toBe(resolved.blocked.attempts[0]?.receipt?.sessionId);
			expect(repair?.prompt).toContain("Fetch and merge main");
			expect(repair?.prompt).toContain(`same branch and PR (${daemon.pullRequestUrl()})`);
			expect(repair?.prompt).toContain("push the changes");
			if (body) {
				expect(repair?.prompt).toContain(body);
			}
			expect(reviewHeads(launched)).toEqual(reviewHeads(resolved.blocked));
			expect((yield* daemon.request("fleet.resolve", resolved.response)).attempts).toEqual(launched.attempts);
			daemon.setMergeable("MERGEABLE");
			daemon.finishPullRequestTurn(launched, MOVED);
			const reviewed = yield* daemon.request("fleet.reconcile", { workId: "one" });
			expect(reviewed.result).toMatchObject({ head: MOVED, pr: daemon.pullRequestUrl() });
			expect(reviewed.review).toMatchObject({ head: MOVED, verdict: "approved" });
			expect(reviewed.checks).toMatchObject({ head: MOVED, passed: true });
			expect(reviewHeads(reviewed)).toEqual([HEAD, HEAD, MOVED]);
		});
	});
}
