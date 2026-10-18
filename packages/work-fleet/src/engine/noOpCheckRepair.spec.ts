import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { engine } from "#test/engineStory.ts";
import { ADOPTED_HEAD, checkRun } from "#test/githubChecks.ts";
import { repairKeepsTheSameHead, repairSubmissionCanBeRejected } from "#test/noOpCheckRepairScenarios.ts";

{
	const setup = repairKeepsTheSameHead();
	engine.it(
		"a check repair without a new head revalidates without another review after restart",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const repairing = yield* fleet.reconcile("one");
			expect(repairing.value.attempts.at(-1)?.role).toBe("repair");
			const review = repairing.value.review;
			context.github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, name: "verify", status: "in_progress" })]]);
			finishWorkers();
			const pending = yield* restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
			expect(pending.value.stage).toBe("validating");
			expect(pending.value.review).toEqual(review);
			expect(fixture.reviews).toEqual([ADOPTED_HEAD]);
			context.github.reply(ADOPTED_HEAD, [[checkRun({ name: "verify" })]]);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
			expect(fixture.reviews).toEqual([ADOPTED_HEAD]);
		},
	);
}

{
	const setup = repairSubmissionCanBeRejected();
	engine.it(
		"three no-op check repairs exhaust despite a rejected submission between them",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			finishWorkers();
			context.reject = true;
			const rejected = yield* fleet.reconcile("one");
			expect(rejected.value.attempts.at(-1)).toMatchObject({ role: "repair", status: "failed" });
			expect(rejected.value.attempts.at(-1)?.receipt).toBeUndefined();
			context.reject = false;
			context.now += 30_000;
			yield* fleet.reconcile("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			finishWorkers();
			const stopped = yield* restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
			expect(stopped.value).toMatchObject({ decision: { code: "checks-repair-exhausted" }, stage: "needs-human" });
			expect(stopped.value.attempts.filter((attempt) => attempt.role === "repair" && attempt.status === "completed")).toHaveLength(3);
			expect(fixture.decisions).toHaveLength(1);
		},
	);
}
