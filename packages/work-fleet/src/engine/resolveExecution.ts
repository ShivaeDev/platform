import { Effect } from "effect";
import { authorizeResolution } from "#engine/authorizeResolution.ts";
import type { EngineState } from "#engine/makeState.ts";
import { releaseExecution } from "#engine/releaseExecution.ts";
import { retireUnacknowledged } from "#engine/retireUnacknowledged.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const resolveExecution = Effect.fn("Fleet.resolveExecution")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	action: "retry" | "release",
) {
	if (action === "retry") {
		yield* authorizeResolution(state, stored.value, action);
	}
	const fenced = yield* retireUnacknowledged(state, stored);
	const current = action === "release" && executing(fenced.value) ? yield* releaseExecution(state, fenced) : fenced;
	if (action === "release") {
		yield* authorizeResolution(state, current.value, action);
	}
	const latest = current.value.attempts.at(-1);
	if (
		action === "retry"
		&& latest?.status === "failed"
		&& latest.role !== "reviewer"
		&& latest.receipt === undefined
		&& latest.sessionId !== undefined
		&& /\bturn already active for thread\b.*\bactive-turn resubmission limit reached\b/iu.test(current.value.decision?.reason ?? "")
	) {
		return {
			...current,
			value: {
				...current.value,
				attempts: current.value.attempts.map((attempt) =>
					attempt.operationId === latest.operationId ? { ...attempt, sessionUnusable: true } : attempt,
				),
			},
		};
	}
	return current;
});
