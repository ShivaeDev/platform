import { Effect } from "effect";
import { authorizeResolution } from "#engine/authorizeResolution.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import type { EngineState } from "#engine/makeState.ts";
import { observeDoneExecution } from "#engine/observeDoneExecution.ts";
import { executing, type FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export function settleDone(state: EngineState) {
	const settle = Effect.fn("Fleet.settle")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		if (["completed", "released"].includes(stored.value.stage)) {
			return yield* closeDecisions(state)(stored);
		}
		stored = yield* observeDoneExecution(state)(stored);
		if (executing(stored.value)) {
			return stored;
		}
		yield* authorizeResolution(state, stored.value, "release");
		const published = stored.value.decision?.published;
		stored = yield* state.save(stored, {
			...stored.value,
			blocker: undefined,
			decision: undefined,
			decisionPublished: undefined,
			launchRetry: undefined,
			mergeReadyAt: undefined,
			mergeReadyHead: undefined,
			stage: "released",
			supersededDecisions:
				published === undefined
					? stored.value.supersededDecisions
					: [...(stored.value.supersededDecisions ?? []), { published, supersededAt: state.policy.now() }],
		});
		return yield* closeDecisions(state)(stored);
	});
	return (stored: Versioned<FleetRecord>) =>
		settle(stored).pipe(
			Effect.catch(
				(error): Effect.Effect<Versioned<FleetRecord>, Effect.Error<ReturnType<typeof settle>>> =>
					error instanceof FleetFailure || error instanceof SessionFailure ? retain(stored.value.workId, error.message) : Effect.fail(error),
			),
		);
	function retain(workId: string, message: string) {
		return state.load(workId).pipe(Effect.flatMap((current) => state.save(current, { ...current.value, blocker: message })));
	}
}
