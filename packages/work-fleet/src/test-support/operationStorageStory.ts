import { Context, Layer } from "effect";
import { withTestTransaction } from "@shivaedev/test-sql/server/withTestTransaction.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { operationRecord } from "#engine/operationRecord.ts";
import { FleetRepository, fleetSessionJournal } from "#engine/repository.ts";
import { FleetRecord } from "#model.ts";
import { SessionJournal } from "#session/service.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
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
		journal,
		operationRecord: (operationId: string) => {
			story.tell(`find stored owner of ${operationId}`);
			return operationRecord(store, operationId);
		},
		store,
	}),
});
