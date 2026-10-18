import { expect } from "@effect/vitest";
import { repairKeepsTheSameHead, repairSubmissionCanBeRejected } from "#test/engineCheckTraits.ts";
import { engine } from "#test/engineStory.ts";
import { ADOPTED_HEAD, checkRun } from "#test/githubChecks.ts";

{
	const setup = repairKeepsTheSameHead();
	engine.it(
		"a check repair without a new head revalidates without another review after restart",
		[setup],
		function* ({ fleet, prepareWork, finishWorkers, restart, checksRespond, reviewedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const repairing = yield* fleet.reconcile("one");
			expect(repairing.value.attempts.at(-1)?.role).toBe("repair");
			const review = repairing.value.review;
			checksRespond(ADOPTED_HEAD, [[checkRun({ conclusion: null, name: "verify", status: "in_progress" })]]);
			finishWorkers();
			yield* restart();
			const pending = yield* fleet.reconcile("one");
			expect(pending.value.stage).toBe("validating");
			expect(pending.value.review).toEqual(review);
			expect(reviewedHeads()).toEqual([ADOPTED_HEAD]);
			checksRespond(ADOPTED_HEAD, [[checkRun({ name: "verify" })]]);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
			expect(reviewedHeads()).toEqual([ADOPTED_HEAD]);
		},
	);
}
{
	const setup = repairSubmissionCanBeRejected();
	engine.it(
		"three no-op check repairs exhaust despite a rejected submission between them",
		[setup],
		function* ({ fleet, prepareWork, finishWorkers, restart, rejectProvider, recoverProvider, advanceTime, publishedDecisions }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			finishWorkers();
			rejectProvider();
			const rejected = yield* fleet.reconcile("one");
			expect(rejected.value.attempts.at(-1)).toMatchObject({ role: "repair", status: "failed" });
			expect(rejected.value.attempts.at(-1)?.receipt).toBeUndefined();
			recoverProvider();
			advanceTime(30_000);
			yield* fleet.reconcile("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			finishWorkers();
			yield* restart();
			const stopped = yield* fleet.reconcile("one");
			expect(stopped.value).toMatchObject({ decision: { code: "checks-repair-exhausted" }, stage: "needs-human" });
			expect(stopped.value.attempts.filter((attempt) => attempt.role === "repair" && attempt.status === "completed")).toHaveLength(3);
			expect(publishedDecisions()).toHaveLength(1);
		},
	);
}
