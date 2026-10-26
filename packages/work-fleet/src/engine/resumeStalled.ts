import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { DecisionResponse } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export const resumeStalled = Effect.fn("Fleet.resumeStalled")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	responses?: readonly DecisionResponse[],
) {
	const record = stored.value;
	const latest = record.attempts.at(-1);
	const published = record.decision?.published;
	const now = state.policy.now();
	return yield* state
		.save(stored, {
			...record,
			attempts: record.attempts.map((attempt) =>
				attempt.operationId === latest?.operationId
					? {
							...attempt,
							progress: responses === undefined || attempt.progress === undefined ? attempt.progress : { ...attempt.progress, at: now },
							sessionUnusable: undefined,
							stallRecovery: undefined,
						}
					: attempt,
			),
			blocker: undefined,
			decision: undefined,
			decisionPublished: false,
			responses: responses ?? record.responses,
			step: latest?.role === "reviewer" ? "reviewing" : "working",
			supersededDecisions:
				responses === undefined && published !== undefined
					? [...(record.supersededDecisions ?? []), { published, supersededAt: now }]
					: record.supersededDecisions,
		})
		.pipe(Effect.flatMap(closeDecisions(state)));
});

export function resumeActiveStall(state: EngineState, stored: Versioned<FleetRecord>, previous: Attempt, observation: SessionObservation) {
	const observed = stored.value.attempts.find((attempt) => attempt.operationId === previous.operationId);
	const active = observation.execution === "completed" || (observed?.progress?.at ?? 0) > (previous.progress?.at ?? 0);
	return stored.value.decision?.code === "session-stalled" && active ? resumeStalled(state, stored) : Effect.succeed(stored);
}
