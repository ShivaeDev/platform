import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import { type BoardWork, FleetFailure } from "#policy.ts";
import type { SessionReceipt } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export function observeRenewal({ sessions, save }: EngineState) {
	return Effect.fn("Fleet.observeRenewal")(function* (stored: Versioned<FleetRecord>, worker: Attempt, receipt: SessionReceipt) {
		const observation = yield* sessions.observe(receipt).pipe(
			Effect.mapError(
				() =>
					new FleetFailure({
						message: "Existing worker observation is unavailable; reconcile ownership before renewal",
						reason: "denied",
					}),
			),
		);
		if (observation.receipt.sessionId !== receipt.sessionId || observation.receipt.turnId !== receipt.turnId) {
			return yield* Effect.fail(
				new FleetFailure({
					message: "Existing worker observation changed the exact receipt; reconcile ownership before renewal",
					reason: "denied",
				}),
			);
		}
		const attempts = stored.value.attempts.map((attempt) =>
			attempt.operationId === worker.operationId ? { ...attempt, output: observation.output, status: observation.execution } : attempt,
		);
		const observed = yield* save(stored, { ...stored.value, attempts });
		if (observation.execution === "accepted" || observation.execution === "running") {
			return yield* Effect.fail(
				new FleetFailure({
					message: "Existing worker is not confirmed terminal; reconcile before renewal",
					reason: "denied",
				}),
			);
		}
		return { observation, observed };
	});
}
export const priorBoardWork = Effect.fn("Fleet.priorBoardWork")(function* (record: FleetRecord, work: BoardWork) {
	const context = record.boardContext;
	const sourcePath = record.boardSourcePath;
	if (context === undefined || sourcePath === undefined) {
		return yield* Effect.fail(
			new FleetFailure({
				message: "Prior Board context is unavailable; reconcile existing result ownership before renewal",
				reason: "denied",
			}),
		);
	}
	return { ...work, context, revision: record.boardRevision, sourcePath };
});
