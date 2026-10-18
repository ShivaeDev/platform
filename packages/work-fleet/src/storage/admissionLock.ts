import { Data, Effect } from "effect";
import { SqlClient } from "effect/sql";

export class AdmissionBusy extends Data.TaggedError("FleetAdmissionBusy") {}

export const admissionLock = Effect.fn("FleetStore.admissionLock")(function* (namespace: string, shared?: boolean) {
	const sql = yield* SqlClient.SqlClient;
	const key = `work_fleet_admission:${namespace}`;
	const rows = yield* shared
		? sql<{ readonly acquired: boolean }>`select pg_try_advisory_xact_lock_shared(hashtextextended(${key}, 0)) as acquired`
		: sql<{ readonly acquired: boolean }>`select pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) as acquired`;
	if (rows[0]?.acquired !== true) {
		return yield* new AdmissionBusy();
	}
});

// Retry outside the transaction so admission waiters return their connections to the pool.
export function retryAdmission<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, Exclude<E, AdmissionBusy>, R>;
export function retryAdmission<A, E, R>(effect: Effect.Effect<A, E | AdmissionBusy, R>): Effect.Effect<A, E, R> {
	return Effect.catchIf(
		effect,
		(error): error is AdmissionBusy => error instanceof AdmissionBusy,
		() =>
			Effect.sleep("25 millis").pipe(
				Effect.withSpan("FleetStore.waitAdmission"),
				Effect.andThen(() => retryAdmission(effect)),
			),
		(error) => Effect.fail(error),
	);
}
