import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";
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
	if (idle === false && state.policy.now() - missingSince < 5 * 60_000) {
		return yield* state.save(stored, {
			...record,
			attempts: record.attempts.map((entry) => (entry.operationId === attempt.operationId ? { ...entry, missingSince } : entry)),
			attentionOwner: "automation",
			blocker: "Accepted Codex turn is not observable; thread remains active; waiting within the visibility grace period",
		});
	}
	let reason: string | undefined;
	if (idle !== true) {
		const uncertainty = idle === false ? "thread remains active after the visibility grace period" : "thread idle state is unknown";
		reason = `Accepted Codex turn is not observable; ${uncertainty}; retain execution ownership`;
	} else if (!answered && record.attempts.some((entry) => entry.publishedRecovery !== undefined)) {
		reason = "Accepted Codex turn is not observable after one automatic relaunch in this execution cycle";
	}
	if (reason !== undefined) {
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

const inspectThread = Effect.fn("Fleet.inspectThread")(function* (state: EngineState, attempt: Attempt) {
	if (attempt.receipt === undefined) {
		return yield* state.sessions.reconcile({ operationId: attempt.operationId, sessionId: attempt.sessionId }).pipe(
			Effect.as(undefined),
			Effect.catch((error) => Effect.succeed(error instanceof SessionFailure ? error.threadIdle : undefined)),
		);
	}
	return yield* state.sessions.observe(attempt.receipt).pipe(
		Effect.map((observation) => {
			if (observation.turnMissing !== true || observation.progress === undefined) {
				return undefined;
			}
			return observation.progress.length === 0;
		}),
		Effect.catch(() => Effect.succeed(undefined)),
	);
});
