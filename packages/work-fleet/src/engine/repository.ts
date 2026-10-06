import { Context, Effect, Layer } from "effect";
import { type Attempt, backlog, executing, FleetRecord, owns, reservations } from "#model.ts";
import { SessionFailure, type SessionReceipt } from "#session/schema.ts";
import { SessionJournal } from "#session/service.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";

type Store = Effect.Success<ReturnType<typeof makePostgresFleetStore<typeof FleetRecord>>>;
export class FleetRepository extends Context.Service<FleetRepository, Omit<Store, "initialize">>()("@shivaedev/work-fleet/FleetRepository") {}
export function postgresFleetRepository(namespace?: string) {
	return Layer.effect(FleetRepository)(
		Effect.gen(function* () {
			const store = yield* makePostgresFleetStore(FleetRecord, {
				backlog,
				executing,
				owns,
				reservations,
				submissions: (record, since) => record.attempts.filter((attempt) => attempt.submittedAt >= since).length,
				...(namespace === undefined ? {} : { namespace }),
			});
			yield* store.initialize();
			return store;
		}),
	);
}
export const fleetSessionJournal = Layer.effect(SessionJournal)(
	Effect.gen(function* () {
		const store = yield* FleetRepository;
		function acknowledge(
			operationId: string,
			sessionId: string,
			receipt?: {
				readonly sessionId: string;
				readonly turnId: string;
			},
		) {
			return Effect.gen(function* () {
				const records = yield* store.list();
				const matches = records.flatMap((record) => record.value.attempts.filter((attempt) => attempt.operationId === operationId).map(() => record));
				const stored = matches.length === 1 ? matches[0] : undefined;
				if (stored === undefined) {
					return yield* Effect.fail(new SessionFailure({ message: "Submission intent was not persisted", reason: "persistence" }));
				}
				const original = stored.value.attempts.find((attempt) => attempt.operationId === operationId);
				if (
					original === undefined
					|| (original.sessionId !== undefined && original.sessionId !== sessionId)
					|| (receipt !== undefined
						&& original.receipt !== undefined
						&& (original.receipt.sessionId !== receipt.sessionId || original.receipt.turnId !== receipt.turnId))
				) {
					return yield* Effect.fail(
						new SessionFailure({ message: "Submission acknowledgement conflicts with the persisted exact receipt", reason: "persistence" }),
					);
				}
				const attempts = stored.value.attempts.map((attempt) => acknowledgedAttempt(attempt, operationId, sessionId, receipt));
				yield* store.compareAndSet(stored.value.workId, stored.version, { ...stored.value, attempts });
			}).pipe(
				Effect.mapError((error) =>
					error instanceof SessionFailure
						? error
						: new SessionFailure({ message: "Receipt persistence failed; reconcile the existing operation", reason: "persistence" }),
				),
			);
		}
		return {
			acknowledgeSession: (operationId: string, sessionId: string) => acknowledge(operationId, sessionId),
			acknowledgeTurn: (
				operationId: string,
				receipt: {
					readonly sessionId: string;
					readonly turnId: string;
				},
			) => acknowledge(operationId, receipt.sessionId, receipt),
		};
	}),
);

function acknowledgedAttempt(attempt: Attempt, operationId: string, sessionId: string, receipt?: SessionReceipt): Attempt {
	if (attempt.operationId !== operationId) {
		return attempt;
	}
	if (receipt === undefined) {
		return { ...attempt, sessionId };
	}
	return { ...attempt, receipt, sessionId, status: attempt.status === "submitting" ? "accepted" : attempt.status };
}
