import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { answerWork } from "#host/answerWork.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";
import type { FleetRecord } from "#model.ts";
import type { AnswerHostEngine } from "#test/AnswerHostEngine.ts";
import { storeState } from "#test/storeState.ts";

export function answerPublicationVerbs(engine: AnswerHostEngine) {
	return {
		answerAcrossPublication: (waiting: FleetRecord, step: "repairing" | "working", input: { readonly text: string; readonly release: boolean }) =>
			Effect.gen(function* () {
				const fleet = engine.fleet;
				const publishedWorkIds: string[] = [];
				const racing = {
					...fleet,
					publishDecision: (workId: string) =>
						Effect.gen(function* () {
							publishedWorkIds.push(workId);
							yield* storeState(engine.host.host, workId, { ...waiting, decision: undefined, step });
							return yield* fleet.publishDecision(workId);
						}),
				};
				const result = yield* withDecisionResponses(engine.host.host, answerWork(engine.host.host, waiting.workId, input)).pipe(
					Effect.provideService(Fleet, racing),
					Effect.result,
				);
				return { publications: publishedWorkIds.length, publishedWorkIds, result };
			}).pipe(Effect.provideContext(engine.running.context)),
	};
}
