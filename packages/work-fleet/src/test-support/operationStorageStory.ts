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
import { storageRecordVerbs } from "#test/storageRecordVerbs.ts";

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
		recordsHolding: (operationId: string) =>
			store
				.operationEntries(operationId)
				.pipe(Effect.map((entries) => entries.map(({ workId }) => workId).toSorted((left, right) => left.localeCompare(right)))),
		...storageRecordVerbs(() => store, story.tell),
	}),
});
