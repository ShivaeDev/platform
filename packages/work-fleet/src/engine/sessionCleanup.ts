import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { type Attempt, allAttempts, type FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

function sessionId(attempt: Attempt) {
	return attempt.receipt?.sessionId ?? attempt.sessionId;
}

export function pendingSessionCleanup(record: FleetRecord): readonly string[] {
	const attempts = allAttempts(record);
	const eligible = [
		...(record.history ?? []).flatMap((cycle) => cycle.attempts),
		...(["completed", "released"].includes(record.stage) ? record.attempts : []),
	];
	return [...new Set(eligible.filter((attempt) => !attempt.sessionCleanupComplete).map(sessionId))].filter(
		(id): id is string =>
			id !== undefined && !attempts.some((attempt) => sessionId(attempt) === id && ["submitting", "accepted", "running"].includes(attempt.status)),
	);
}

export function cleanupSessions({ sessions, load, save }: EngineState) {
	return Effect.fn("Fleet.cleanupSessions")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		for (const id of pendingSessionCleanup(stored.value)) {
			const result = yield* sessions.archive(id).pipe(Effect.result);
			if (result._tag === "Failure") {
				yield* Effect.logWarning("Fleet session cleanup failed; reconciliation will retry");
				continue;
			}
			stored = yield* load(input.value.workId);
			if (!pendingSessionCleanup(stored.value).includes(id)) {
				continue;
			}
			function complete(attempt: Attempt): Attempt {
				return sessionId(attempt) === id ? { ...attempt, sessionCleanupComplete: true } : attempt;
			}
			stored = yield* save(stored, {
				...stored.value,
				attempts: stored.value.attempts.map(complete),
				...(stored.value.history === undefined
					? {}
					: { history: stored.value.history.map((cycle) => ({ ...cycle, attempts: cycle.attempts.map(complete) })) }),
			});
		}
		return stored;
	});
}
