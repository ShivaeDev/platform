import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { decisionPublicationFailsOnce, workerAcknowledgementLost } from "#test/engineLaunchTraits.ts";
import { checksRequestRepair, noChangeChecksFailOnce } from "#test/engineLifecycleTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, independentReviewFailsOnce, reviewerStillRunning } from "#test/engineTraits.ts";

describe("Fleet recovery", () => {
	engine.it(
		"rebuilding services adopts a lost turn acknowledgement without duplicate launch or human action",
		[workerAcknowledgementLost()],
		function* ({ fleet, prepareWork, afterRestart, launches, publishedDecisions }) {
			yield* prepareWork("one");

			const intent = yield* fleet.dispatch("one");
			expect(intent.value.step).toBe("working");
			expect(intent.value.attempts[0]?.receipt).toBeUndefined();
			yield* afterRestart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					const adopted = yield* restarted.reconcile("one");
					expect(adopted.value.attempts[0]?.receipt?.turnId).toBe("turn-operation-1");
				}),
			);
			expect(launches()).toHaveLength(1);
			expect(publishedDecisions()).toHaveLength(0);
		},
	);
	engine.it(
		"review retry reconciles the submitted reviewer instead of starting another session",
		[independentReviewFailsOnce()],
		function* ({ fleet, prepareWork, finishWorkers, respond, launches }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const failed = yield* fleet.reconcile("one");
			expect(failed.value.step).toBe("waiting");
			expect(failed.value.attempts.at(-1)?.role).toBe("reviewer");
			yield* fleet.resolve("one", failed.value.decision?.id ?? "missing", respond(failed.value.decision?.id ?? "missing", "retry"));
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect(launches()).toHaveLength(2);
		},
	);
	engine.it(
		"durable Board question publication retries after failure",
		[humanMergeRequired(), decisionPublicationFailsOnce()],
		function* ({ fleet, prepareWork, finishWorkers, publishedDecisions }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const failed = yield* fleet.reconcile("one");
			expect(failed.value.decisionPublished).toBe(false);
			expect(publishedDecisions()).toHaveLength(0);
			expect((yield* fleet.reconcile("one")).value.decisionPublished).toBe(true);
			expect(publishedDecisions()).toHaveLength(1);
		},
	);
	engine.it(
		"no-change validation retry keeps original worker and reviewer",
		[noChangeChecksFailOnce()],
		function* ({ fleet, prepareWork, finishWorkers, respond, launches }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const failed = yield* fleet.reconcile("one");
			expect(failed.value.step).toBe("waiting");
			yield* fleet.resolve("one", failed.value.decision?.id ?? "missing", respond(failed.value.decision?.id ?? "missing", "retry"));
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect(launches()).toHaveLength(2);
		},
	);
	engine.it(
		"required checks with scoped guidance repair automatically and revalidate the new head",
		[checksRequestRepair()],
		function* ({ fleet, prepareWork, finishWorkers, publishedDecisions, reviewedHeads }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const repair = yield* fleet.reconcile("one");
			expect(repair.value.step).toBe("working");
			expect(repair.value.checks?.passed).toBe(false);
			expect(publishedDecisions()).toHaveLength(0);
			finishWorkers();
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.step).toBe("done");
			expect(completed.value.checks?.head).toBe("head-one-1");
			expect(reviewedHeads()).toHaveLength(2);
		},
	);
	engine.it(
		"cached running reviewer retries its exact observation after failure",
		[reviewerStillRunning()],
		function* ({ fleet, prepareWork, finishWorkers, respond, launches, failTurnObservation }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const reviewing = yield* fleet.reconcile("one");
			const receipt = reviewing.value.attempts.at(-1)?.receipt;
			failTurnObservation(receipt?.turnId ?? "missing");
			const failed = yield* fleet.reconcile("one");
			expect(failed.value.step).toBe("waiting");
			yield* fleet.resolve("one", failed.value.decision?.id ?? "missing", respond(failed.value.decision?.id ?? "missing", "retry"));
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect(launches()).toHaveLength(2);
		},
	);
});
