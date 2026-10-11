import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { FleetRecord } from "#model.ts";
import type { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

type Store = Effect.Success<ReturnType<typeof makePostgresFleetStore<typeof FleetRecord>>>;

export const attentionStorage = Effect.fn("FleetFixture.attentionStorage")(function* (
	original: Store,
	namespace: string,
	writeGate: EngineOptions["writeGate"],
	writeFailure?: EngineOptions["writeFailure"],
) {
	const sql = yield* SqlClient.SqlClient;
	const store = {
		...original,
		compareAndSet: (...args: Parameters<typeof original.compareAndSet>) => {
			const failure = writeFailure?.(args[2]);
			return failure === undefined
				? (writeGate?.(args[2]) ?? Effect.void).pipe(Effect.andThen(original.compareAndSet(...args)))
				: Effect.fail(failure);
		},
	};
	const replaceRecord = Effect.fn("FleetFixture.replaceRecord")(function* (value: FleetRecord) {
		const stored = yield* store.load(value.workId);
		if (stored === undefined) {
			return yield* Effect.die("Missing fixture record");
		}
		yield* store.compareAndSet(value.workId, stored.version, value);
	});
	return {
		replaceRecord,
		store,
		upgradeAttention: sql`delete from ${sql(`${namespace}_migrations`)} where migration_id >= 4`.pipe(
			Effect.andThen(store.initialize()),
			Effect.asVoid,
			Effect.provideService(SqlClient.SqlClient, sql),
		),
		upgradeDecisionCodes: sql`delete from ${sql(`${namespace}_migrations`)} where migration_id = 5`.pipe(
			Effect.andThen(store.initialize()),
			Effect.asVoid,
			Effect.provideService(SqlClient.SqlClient, sql),
		),
	};
});
