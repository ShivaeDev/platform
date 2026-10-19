import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { githubPullRequest, markdownWork, reviewerStillRunning } from "#test/engineTraits.ts";
import { REPORT } from "#test/githubResult.ts";

for (const action of ["retry", "release"] as const) {
	isolatedEngine.it(
		`a changed brief after a finished worker turn supports ${action} after restart`,
		[githubPullRequest({}), markdownWork(), reviewerStillRunning()],
		function* (fleet) {
			yield* fleet.prepareWork("one");
			const first = yield* fleet.dispatch("one");
			const edited = `${fleet.boardBrief().replace("kind: task", "kind: task\nowner: human")}\nChanged criteria.\n`;
			fleet.writeBoardWork("one.md", edited);
			fleet.workerReports(REPORT);
			fleet.finishWorkers();
			const stopped = yield* fleet.reconcile("one");
			expect(stopped.value).toMatchObject({ decision: { code: "fleet-stale" }, stage: "needs-human" });
			yield* fleet.restart();
			yield* fleet.answerPublishedDecision("one", action);
			yield* fleet.reconcile("one");
			const resumed = yield* fleet.reconcile("one");
			if (action === "release") {
				expect(resumed.value.stage).toBe("released");
				expect(resumed.value.attempts.map((attempt) => attempt.operationId)).toEqual(stopped.value.attempts.map((attempt) => attempt.operationId));
				return;
			}
			expect(resumed.value.stage).toBe("executing");
			expect(resumed.value.boardContext).toBe(edited);
			expect(resumed.value.attempts[0]?.receipt).toEqual(first.value.attempts[0]?.receipt);
			expect(resumed.value.attempts.at(-1)).toMatchObject({
				prompt: expect.stringContaining("Fleet approved an edited brief"),
				receipt: { sessionId: first.value.attempts[0]?.receipt?.sessionId },
				role: "repair",
			});
			expect(resumed.value.attempts.at(-1)?.prompt).toContain(edited);
			expect(resumed.value.pendingAnswers).toBeUndefined();
		},
	);
}
