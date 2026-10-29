import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
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
	const attempt = stored.value.attempts.at(-1);
	if (attempt === undefined) {
		return stored;
	}
	const idle = answered ? yield* inspectThread(state, attempt) : threadIdle;
	const current = answered ? yield* state.load(stored.value.workId) : stored;
	const record = current.value;
	const missingSince = attempt.missingSince ?? state.policy.now();
	if (answered && idle !== true) {
		return yield* new ServiceUnavailable({
			message:
				"Cannot apply answer: the accepted turn is still unobservable and the worker thread is active or unreadable; no answer turn was submitted",
		});
	}
	if (idle === false && state.policy.now() - Math.max(missingSince, attempt.progress?.at ?? 0) < VISIBILITY_GRACE_MS) {
		return yield* state.save(current, {
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
					current,
					"session-turn-missing",
					reason,
					"Inspect the worker thread and published work before retrying or safely releasing",
				)
			: yield* state.save(current, { ...record, blocker: reason });
	}
	return undefined;
});
