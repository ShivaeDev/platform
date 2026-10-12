import { Effect } from "effect";
import { Conflict } from "@shivaedev/platform/errors/taxonomy.ts";
import { applyResolution } from "#engine/applyResolution.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import type { EngineState } from "#engine/makeState.ts";
import { readResolution } from "#engine/readResolution.ts";
import type { FleetRecord } from "#model.ts";

export function resolveCommand(state: EngineState) {
	const { board, policy, load } = state;
	return Effect.fn("Fleet.resolve")(
		function* (workId: string, decisionId: string, responseId: string) {
			const stored = yield* load(workId);
			if (hasResponse(stored.value, decisionId, responseId)) {
				return yield* ensurePublication(state)(stored).pipe(Effect.flatMap(closeDecisions(state)));
			}
			if (stored.value.decision?.id !== decisionId) {
				return yield* Effect.fail(new Conflict({ message: "Decision changed" }));
			}
			const { action, published, response } = yield* readResolution(board, stored.value.decision, responseId);
			const receipt = {
				...(action === undefined ? {} : { action }),
				decisionId,
				processedAt: policy.now(),
				published,
				questionId: published.questionId,
				questionRevision: published.revision,
				responseId,
				type: response.response.type,
			};
			const responses = [...(stored.value.responses ?? []), receipt];
			return yield* applyResolution(state)(stored, responses, action, response.body, responseId);
		},
		(effect) => effect.pipe(Effect.catchTag("StorageConflict", () => Effect.fail(new Conflict({ message: "Decision changed" })))),
	);
}

function hasResponse(record: FleetRecord, decisionId: string, responseId: string) {
	const prior = [...(record.history ?? []).flatMap((cycle) => cycle.responses ?? []), ...(record.responses ?? [])];
	return prior.some((previous) => previous.decisionId === decisionId && previous.responseId === responseId);
}
