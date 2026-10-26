import { Effect } from "effect";
import { briefChanged } from "#engine/boardBrief.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

// A message to a working agent interrupts it, so a silent turn is only reported, never steered or interrupted.
export const recoverStall = Effect.fn("Fleet.recoverStall")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	attempt: Attempt | undefined,
	subscribedAt?: number,
) {
	if (stored.value.step === "waiting" || attempt?.receipt === undefined) {
		return undefined;
	}
	const now = state.policy.now();
	const minutes = (yield* state.current).stallMinutes ?? 30;
	if (!stalled(attempt, now, minutes, subscribedAt)) {
		return undefined;
	}
	const work = yield* state.board.get(stored.value.workId);
	if (!work.approved || briefChanged(stored.value, work)) {
		return undefined;
	}
	const marked = {
		...stored,
		value: {
			...stored.value,
			attempts: stored.value.attempts.map((entry) =>
				entry.operationId === attempt.operationId ? { ...entry, sessionUnusable: true, stallRecovery: { count: 0, lastActionAt: now } } : entry,
			),
		},
	};
	return yield* state.decision(
		marked,
		"session-stalled",
		`Provider turn showed no activity for ${minutes} minutes`,
		"Keep waiting, retry in a fresh session or abandon the stalled turn and release ownership",
	);
});

function stalled(attempt: Attempt, now: number, minutes: number, subscribedAt = 0) {
	return (
		attempt.status === "running"
		&& attempt.progress !== undefined
		&& now - Math.max(attempt.progress.at, attempt.submittedAt, subscribedAt) >= minutes * 60_000
	);
}
