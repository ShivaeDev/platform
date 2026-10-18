import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { FleetRepository } from "#engine/repository.ts";
import type { FleetRecord } from "#model.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { legacyStore } from "#test/legacyStore.ts";
import { migrateFleet } from "#test/migrateFleet.ts";

export const attentionStorage = Effect.fn("FleetFixture.attentionStorage")(function* (
	original: typeof FleetRepository.Service,
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
	const upgrade = legacyStore(namespace).pipe(
		Effect.andThen(migrateFleet(namespace)),
		Effect.asVoid,
		Effect.provideService(SqlClient.SqlClient, sql),
	);
	return {
		replaceRecord,
		store,
		upgradeAttention: upgrade,
		upgradeDecisionCodes: upgrade,
	};
});
