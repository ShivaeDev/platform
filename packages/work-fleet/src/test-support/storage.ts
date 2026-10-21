import { Effect } from "effect";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import type { AdmissionLimits, Versioned } from "#storage/model.ts";
import { STORAGE_NAMESPACE, StorageRecord } from "#test/StorageRecord.ts";

export function record(workId: string): typeof StorageRecord.Type {
	return { step: "queued", workId };
}

export function storageOptions(namespace: string) {
	return {
		backlog: (value: typeof StorageRecord.Type) => value.step === "terminal",
		executing: (value: typeof StorageRecord.Type) => value.step === "submitting" || value.step === "running",
		namespace,
		submissions: (value: typeof StorageRecord.Type, since: number) => (value.submittedAt !== undefined && value.submittedAt >= since ? 1 : 0),
	};
}

export const withStorage = Effect.fn("FleetFixture.withStorage")(function* <A, E, R>(
	use: (store: Effect.Success<ReturnType<typeof makeTestStore>>, namespace: string) => Effect.Effect<A, E, R>,
) {
	const store = yield* makeTestStore(STORAGE_NAMESPACE);
	return yield* use(store, STORAGE_NAMESPACE);
});

export function makeTestStore(namespace: string) {
	return makePostgresFleetStore(StorageRecord, storageOptions(namespace));
}

export function submitAgainstQuota(
	store: Effect.Success<ReturnType<typeof makeTestStore>>,
	entry: Versioned<typeof StorageRecord.Type>,
	limits: AdmissionLimits,
) {
	return store.compareAndSet(
		entry.value.workId,
		entry.version,
		{
			...entry.value,
			operationId: `operation-${entry.value.workId}`,
			step: "submitting",
			submittedAt: 101,
		},
		limits,
	);
}
