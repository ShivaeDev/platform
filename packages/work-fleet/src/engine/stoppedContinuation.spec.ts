import { expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { publishedWorkerBranch } from "#test/publishedWorkerBranch.ts";

for (const phase of ["working", "reviewing"] as const) {
	engine.it(
		`continue after stopping ${phase} work sends the message to its existing worker and stays active after reconciliation`,
		[githubPullRequest(), reviewerStillRunning(), publishedWorkerBranch],
		function* ({ fleet, prepareWork, dispatch, finishWorker, reconcile, restart, turnOutput }) {
			yield* prepareWork("one");
			const worker = yield* dispatch("one");
			if (phase === "reviewing") {
				yield* finishWorker("one");
				yield* reconcile("one");
			}
			const stopped = yield* fleet.stop("one");
			expect(stopped.value).toMatchObject({ releaseReason: expect.stringContaining("Pull request preserved:"), step: "released" });
			yield* restart();

			const continued = yield* fleet.continue("one", "Resolve the conflict on the existing PR");

			expect(continued.value.step).toBe("working");
			expect(continued.value.releaseReason).toBeUndefined();
			expect(continued.value.attempts.at(-1)).toMatchObject({ receipt: { sessionId: worker.value.attempts[0]?.receipt?.sessionId }, role: "repair" });
			expect(turnOutput(continued.value.attempts.at(-1)?.receipt)).toContain("Resolve the conflict on the existing PR");
			expect((yield* reconcile("one")).value.step).toBe("working");
		},
	);
}
