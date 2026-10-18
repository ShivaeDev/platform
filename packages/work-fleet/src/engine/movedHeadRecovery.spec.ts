import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { isolatedEngine } from "#test/engineStory.ts";
import { githubPullRequest } from "#test/engineTraits.ts";
import { BASE, HEAD, MOVED, PR, REPORT } from "#test/githubResult.ts";
import { movedHeadWriteIsInterrupted } from "#test/movedHeadWriteIsInterrupted.ts";

{
	const setup = movedHeadWriteIsInterrupted();
	isolatedEngine.it(
		"restart after persisting the moved head launches one fresh reviewer before delivery",
		[githubPullRequest({}), setup.given],
		function* ({ fixture, fleet, finishWorkers, restart, pullRequest, prepareWork, workerReports }) {
			const context = setup.context();
			const github = pullRequest();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			const reviewing = yield* fleet.reconcile("one");
			expect(reviewing.value.stage).toBe("reviewing");
			expect(reviewing.value.result).toMatchObject({ head: HEAD, pr: PR, prNumber: 7 });
			finishWorkers();
			const approved = yield* fleet.reconcile("one");
			github.state.head = MOVED;
			const moving = yield* fleet.reconcile("one").pipe(Effect.forkChild);
			yield* Deferred.await(context.launching);
			const persisted = yield* fleet.get("one");
			expect(persisted.value.stage).toBe("reviewing");
			expect(persisted.value.result?.head).toBe(MOVED);
			expect(persisted.value.review).toEqual(approved.value.review);
			expect(persisted.value.resultObservations).toEqual([approved.value.result]);
			expect(persisted.value.checks).toBeUndefined();
			expect(persisted.value.decision).toBeUndefined();
			expect(fixture.launched).toHaveLength(2);
			yield* Fiber.interrupt(moving);
			context.interrupted = true;
			const recovered = yield* restart(fleet.reconcile("one"));
			expect(recovered.value.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer", status: "running" });
			expect(recovered.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(approved.value.review?.receipt.sessionId);
			yield* restart(fleet.reconcile("one"));
			expect(fixture.launched).toHaveLength(3);
			finishWorkers();
			yield* restart(fleet.reconcile("one"));
			github.state.status = "MERGED";
			const completed = yield* restart(fleet.reconcile("one"));
			expect(completed.value.stage).toBe("completed");
			expect(completed.value.outcome).toEqual({ head: MOVED, revision: BASE, url: PR });
			expect(completed.value.review).toMatchObject({ head: MOVED, verdict: "approved" });
			expect(completed.value.checks).toMatchObject({ head: MOVED, passed: true });
			expect(fixture.reviews).toEqual([HEAD, MOVED]);
			expect(fixture.launched).toHaveLength(3);
		},
	);
}
