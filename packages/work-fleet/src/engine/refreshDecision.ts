import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { type BoardWork, type DecisionResponse, FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function refreshDecision(state: EngineState) {
	return Effect.fn("Fleet.refreshDecision")(function* (stored: Versioned<FleetRecord>, responses: readonly DecisionResponse[], work: BoardWork) {
		const previous = stored.value.decision;
		if (previous === undefined) {
			return yield* Effect.fail(new FleetFailure({ message: "Decision changed", reason: "stale" }));
		}
		const updated = yield* state.save(stored, {
			...stored.value,
			attentionOwner: "maintainer",
			blocker: undefined,
			decision: {
				...previous,
				attentionOwner: "maintainer",
				id: `${work.workId}.${stored.version}`,
				publicationWork: work,
				published: undefined,
				reason: "Board context changed after this decision was published",
				recommendation: "Approve and prepare the current scope, or safely release this work",
			},
			decisionPublished: false,
			responses,
		});
		return yield* ensurePublication(state)(updated).pipe(Effect.flatMap(closeDecisions(state)));
	});
}
