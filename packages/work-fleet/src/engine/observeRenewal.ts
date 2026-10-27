import { Clock, Effect } from "effect";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import type { EngineState } from "#engine/makeState.ts";
import { observedAttempt } from "#engine/observedAttempt.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { SessionReceipt } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export function observeRenewal({ sessions, save }: EngineState) {
	return Effect.fn("Fleet.observeRenewal")(function* (stored: Versioned<FleetRecord>, worker: Attempt, receipt: SessionReceipt) {
		const observation = yield* sessions
			.observe(receipt)
			.pipe(Effect.mapError(() => new Forbidden({ message: "Existing worker observation is unavailable; reconcile ownership before renewal" })));
		if (observation.receipt.sessionId !== receipt.sessionId || observation.receipt.turnId !== receipt.turnId) {
			return yield* Effect.fail(
				new Forbidden({ message: "Existing worker observation changed the exact receipt; reconcile ownership before renewal" }),
			);
		}
		const now = yield* Clock.currentTimeMillis;
		const attempts = stored.value.attempts.map((attempt) =>
			attempt.operationId === worker.operationId ? observedAttempt(attempt, observation, now) : attempt,
		);
		const observed = yield* save(stored, { ...stored.value, attempts });
		if (observation.execution === "accepted" || observation.execution === "running") {
			return yield* Effect.fail(new Forbidden({ message: "Existing worker is not confirmed terminal; reconcile before renewal" }));
		}
		return { observation, observed };
	});
}
export const priorBoardWork = Effect.fn("Fleet.priorBoardWork")(function* (record: FleetRecord, work: BoardWork) {
	const context = record.boardContext;
	const sourcePath = record.boardSourcePath;
	if (context === undefined || sourcePath === undefined) {
		return yield* Effect.fail(new Forbidden({ message: "Prior Board context is unavailable; reconcile existing result ownership before renewal" }));
	}
	return { ...work, context, revision: record.boardRevision, sourcePath };
});
