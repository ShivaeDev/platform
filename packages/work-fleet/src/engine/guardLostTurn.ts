import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { inspectThread, VISIBILITY_GRACE_MS } from "#engine/visibility.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const guardLostTurn = Effect.fn("Fleet.guardLostTurn")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	answered: boolean,
	threadIdle?: boolean,
) {
	const record = stored.value;
	const attempt = record.attempts.at(-1);
	if (attempt === undefined) {
		return stored;
	}
	const idle = answered ? yield* inspectThread(state, attempt) : threadIdle;
	const missingSince = attempt.missingSince ?? state.policy.now();
	if (idle === false && state.policy.now() - missingSince < VISIBILITY_GRACE_MS) {
		return yield* state.save(stored, {
			...record,
			attempts: record.attempts.map((entry) => (entry.operationId === attempt.operationId ? { ...entry, missingSince } : entry)),
			attentionOwner: "automation",
			blocker: "Accepted Codex turn is not observable; thread remains active; waiting within the visibility grace period",
		});
	}
	if (idle !== true) {
		const uncertainty = idle === false ? "thread remains active after the visibility grace period" : "thread idle state is unknown";
		const reason = `Accepted Codex turn is not observable; ${uncertainty}; retain execution ownership`;
		return record.decision === undefined
			? yield* state.decision(
					stored,
					"session-turn-missing",
					reason,
					"Inspect the worker thread and published work before retrying or safely releasing",
				)
			: yield* state.save(stored, { ...record, blocker: reason });
	}
	return undefined;
});
