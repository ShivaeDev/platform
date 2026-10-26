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
	const now = state.policy.now();
	const published = record.decision?.published;
	return yield* state
		.save(stored, {
			...record,
			attempts: record.attempts.map((attempt) =>
				attempt === latest
					? {
							...attempt,
							progress: attempt.progress === undefined ? undefined : { ...attempt.progress, at: now },
							sessionUnusable: undefined,
							stallRecovery: undefined,
						}
					: attempt,
			),
			blocker: undefined,
			decision: undefined,
			decisionAcknowledged: undefined,
			decisionPublished: undefined,
			responses: responses ?? record.responses,
			step: latest?.role === "reviewer" ? "reviewing" : "working",
			supersededDecisions:
				responses !== undefined || published === undefined
					? record.supersededDecisions
					: [...(record.supersededDecisions ?? []), { published, supersededAt: now }],
		})
		.pipe(Effect.flatMap(closeDecisions(state)));
});

export const resumeObservedStall = Effect.fn("Fleet.resumeObservedStall")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	attempt: Attempt,
	observation: SessionObservation,
) {
	const moving =
		observation.execution === "completed"
		|| (observation.activityAt !== undefined && observation.activityAt >= (attempt.stallRecovery?.lastActionAt ?? Number.POSITIVE_INFINITY))
		|| (observation.progress !== undefined && JSON.stringify(observation.progress) !== attempt.progress?.signature);
	return stored.value.decision?.code === "session-stalled" && moving ? yield* resumeStalled(state, stored) : stored;
});
