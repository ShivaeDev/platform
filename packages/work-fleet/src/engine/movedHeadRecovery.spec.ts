import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { movedHeadWriteIsInterrupted } from "#test/engineBoardTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { githubPullRequest } from "#test/engineTraits.ts";
import { BASE, HEAD, MOVED, PR, REPORT } from "#test/githubResult.ts";

isolatedEngine.it(
	"restart after persisting the moved head launches one fresh reviewer before delivery",
	[githubPullRequest({}), movedHeadWriteIsInterrupted()],
	function* ({
		fleet,
		finishWorkers,
		restart,
		prepareWork,
		workerReports,
		movePullRequestHead,
		waitForMovedHeadWrite,
		launches,
		resumeMovedHeadWrites,
		mergePullRequest,
		reviewedHeads,
	}) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(REPORT);
		const reviewing = yield* fleet.reconcile("one");
		expect(reviewing.value.step).toBe("reviewing");
		expect(reviewing.value.result).toMatchObject({ head: HEAD, pr: PR, prNumber: 7 });
		finishWorkers();
		const approved = yield* fleet.reconcile("one");
		movePullRequestHead(MOVED);
		const moving = yield* fleet.reconcile("one").pipe(Effect.forkChild);
		yield* waitForMovedHeadWrite();
		const persisted = yield* fleet.get("one");
		expect(persisted.value.step).toBe("reviewing");
		expect(persisted.value.result?.head).toBe(MOVED);
		expect(persisted.value.review).toEqual(approved.value.review);
		expect(persisted.value.resultObservations).toEqual([approved.value.result]);
		expect(persisted.value.checks).toBeUndefined();
		expect(persisted.value.decision).toBeUndefined();
		expect(launches()).toEqual(["operation-1", "operation-2"]);
		yield* Fiber.interrupt(moving);
		resumeMovedHeadWrites();
		yield* restart();
		const recovered = yield* fleet.reconcile("one");
		expect(recovered.value.attempts.at(-1)).toMatchObject({ reviewHead: MOVED, role: "reviewer", status: "running" });
		expect(recovered.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(approved.value.review?.receipt.sessionId);
		yield* restart();
		yield* fleet.reconcile("one");
		expect(launches()).toEqual(["operation-1", "operation-2", "operation-4"]);
		finishWorkers();
		yield* restart();
		yield* fleet.reconcile("one");
		mergePullRequest();
		yield* restart();
		const completed = yield* fleet.reconcile("one");
		expect(completed.value.step).toBe("done");
		expect(completed.value.outcome).toEqual({ head: MOVED, revision: BASE, url: PR });
		expect(completed.value.review).toMatchObject({ head: MOVED, verdict: "approved" });
		expect(completed.value.checks).toMatchObject({ head: MOVED, passed: true });
		expect(reviewedHeads()).toEqual([HEAD, MOVED]);
		expect(launches()).toEqual(["operation-1", "operation-2", "operation-4"]);
	},
);
