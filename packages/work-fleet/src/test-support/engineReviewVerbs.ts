import { Effect } from "effect";
import type { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";
import type { EngineFixture } from "#test/engine.ts";
import { exhaustReadRetries } from "#test/exhaustReadRetries.ts";
import { prepareBookkeepingPhase } from "#test/prepareBookkeepingPhase.ts";
import { prepareWaiting } from "#test/prepareWaiting.ts";
import { reportWorker } from "#test/reportWorker.ts";
import { reviewerReply } from "#test/reviewerReply.ts";
import { startReview } from "#test/startReview.ts";
import { askWorker } from "#test/workerQuestion.ts";

type UseFleet = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, typeof Fleet.Identifier>>;

export function engineReviewVerbs(fixture: EngineFixture<unknown>, use: UseFleet, tell: (line: string) => void) {
	function act<A, E, R>(line: string, effect: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => {
			tell(line);
			return use(effect);
		});
	}
	return {
		askWorker: () => act("the worker asks for human guidance", askWorker(fixture)),
		exhaustReadRetries: () => act("exhaust the delivery read retries", exhaustReadRetries(fixture)),
		prepareBookkeepingPhase: (phase: string, wholeFileRevision: boolean) =>
			act(
				`prepare ${phase} work with ${wholeFileRevision ? "whole-file" : "authored"} revision`,
				prepareBookkeepingPhase(fixture, phase, wholeFileRevision),
			),
		reportWorker: () => act("the worker reports its pull request", reportWorker(fixture)),
		reviewerReply: (record: Versioned<FleetRecord>, output: string) =>
			act("the independent reviewer replies", reviewerReply(fixture, record, output)),
		startReview: () => act("start independent review of the reported pull request", startReview(fixture)),
		waitingForHuman: (scenario: "worker question" | "failing check" | "changed head") =>
			act(`work waits for a human after ${scenario}`, prepareWaiting(fixture, scenario)),
		workerReports: (output: string) => {
			tell("the worker finishes with its report");
			for (const [turn, observation] of fixture.observations) {
				fixture.observations.set(turn, { ...observation, execution: "completed", output });
			}
		},
	};
}
