import { Context, Effect, Layer } from "effect";
import { withTestTransaction } from "@shivaedev/test-sql/server/withTestTransaction.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { operationRecord } from "#engine/operationRecord.ts";
import { FleetRepository, fleetSessionJournal } from "#engine/repository.ts";
import { FleetRecord } from "#model.ts";
import type { SessionReceipt } from "#session/schema.ts";
import { SessionJournal } from "#session/service.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { refusal } from "#test/refusal.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

export const operationStorageStory = storyKit({
	around: withTestTransaction,
	clock: "live",
	*create() {
		const store = yield* makePostgresFleetStore(FleetRecord, { namespace: STORAGE_NAMESPACE });
		const journal = Context.get(yield* Layer.build(fleetSessionJournal.pipe(Layer.provide(Layer.succeed(FleetRepository)(store)))), SessionJournal);
		return { journal, store };
	},
	layer: postgresLayer,
	name: "Fleet operation journal",
	runIf: postgresEnabled,
	stages: [],
	verbs: ({ store, journal }, story) => ({
		acknowledgeSession: (operationId: string, sessionId: string) => {
			story.tell(`the provider acknowledges session ${sessionId} for ${operationId}`);
			return refusal(journal.acknowledgeSession(operationId, sessionId));
		},
		acknowledgeTurn: (operationId: string, receipt: SessionReceipt) => {
			story.tell(`the provider acknowledges turn ${receipt.turnId} for ${operationId}`);
			return refusal(journal.acknowledgeTurn(operationId, receipt));
		},
		owner: (operationId: string) => operationRecord(store, operationId).pipe(Effect.map((entry) => entry?.value.workId ?? "no single owner")),
		ownerAfterRacingChange: (operationId: string, workId: string, change: Partial<typeof FleetRecord.Type>) => {
			story.tell(`another writer changes ${workId} right after the ownership snapshot of ${operationId}`);
			const changeRecord = store
				.load(workId)
				.pipe(
					Effect.flatMap((entry) =>
						entry === undefined ? Effect.die(`Missing ${workId}`) : store.compareAndSet(workId, entry.version, { ...entry.value, ...change }),
					),
				);
			const racing = {
				...store,
				operationEntries: (id: string) =>
					store.operationEntries(id).pipe(
						Effect.tap(() => changeRecord),
						Effect.orDie,
					),
			};
			return operationRecord(racing, operationId).pipe(Effect.map((entry) => entry?.value.workId ?? "no single owner"));
		},
		recordsHolding: (operationId: string) =>
			store
				.operationEntries(operationId)
				.pipe(Effect.map((entries) => entries.map(({ workId }) => workId).toSorted((left, right) => left.localeCompare(right)))),
		store,
	}),
});
