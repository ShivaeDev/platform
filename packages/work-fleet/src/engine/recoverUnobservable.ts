import { Effect } from "effect";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import type { EngineState } from "#engine/makeState.ts";
import { resumeAttempt } from "#engine/resumeAttempt.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

const VISIBILITY_GRACE_MS = 5 * 60_000;

export const recoverUnobservable = Effect.fn("Fleet.recoverUnobservable")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	attempt: Attempt | undefined,
) {
	if (attempt?.missingSince === undefined) {
		return undefined;
	}
	if (stored.value.stage === "needs-human" || state.policy.now() - Math.max(attempt.missingSince, attempt.progress?.at ?? 0) < VISIBILITY_GRACE_MS) {
		return stored;
	}
	if ((attempt.observationRetries ?? 0) >= 1) {
		return yield* state.decision(
			stored,
			"session-turn-missing",
			"The acknowledged Codex turn is not observable after the grace period and one automatic resume",
			"Inspect the worker thread and retry or safely release",
		);
	}
	yield* authorizeBriefContext(stored.value, yield* state.board.get(stored.value.workId));
	// Retire the missing receipt and reserve its replacement in the same compare-and-set.
	const retired = {
		...stored,
		value: {
			...stored.value,
			attempts: stored.value.attempts.map((entry) => (entry.operationId === attempt.operationId ? { ...entry, status: "failed" as const } : entry)),
		},
	};
	return yield* resumeAttempt(state, retired, attempt, { observationRetries: 1, stallRecovery: attempt.stallRecovery });
});
