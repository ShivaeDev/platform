import { Effect } from "effect";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { FleetRepository } from "#engine/repository.ts";
import type { FleetRecord } from "#model.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { storeRecords } from "#test/storeState.ts";

export function hostStoreVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		loadStoredRecord: (workId: string) =>
			Effect.flatMap(FleetRepository, (store) => store.load(workId)).pipe(Effect.provideContext(engine.running.context)),
		providerResources: () => {
			if (engine.resources === undefined) {
				throw new Error("Deploy the host before reading its resources");
			}
			return { providers: engine.resources.providers, releases: engine.resources.releases };
		},
		queriesDuring: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			Effect.suspend(() => {
				if (engine.reads === undefined) {
					throw new Error("Deploy the host before reading its queries");
				}
				tell("record the SQL statements the daemon runs");
				const reads = engine.reads;
				const before = reads.statements().length;
				return Effect.map(effect, (value) => ({ queries: reads.statements().slice(before).map(boundQuery), value }));
			}),
		rollbackInsert: (record: FleetRecord, failure: string) => {
			tell(`roll back an insert of ${record.workId}`);
			return Effect.flatMap(FleetRepository, (store) =>
				transact(store.insert(record).pipe(Effect.andThen(Effect.fail(failure))), {
					onSqlError: (error) => error,
				}),
			).pipe(Effect.provideContext(engine.running.context));
		},
		snapshotReadCount: () => {
			if (engine.reads === undefined) {
				throw new Error("Deploy the host before reading its queries");
			}
			return engine.reads.count();
		},
		store: (workId: string, record: Readonly<Record<string, unknown>>) => {
			tell(`store ${workId}'s durable state`);
			return engine.store(workId, record);
		},
		storedRecord: (workId: string) => engine.fleet.get(workId),
		storeRecords: (records: readonly FleetRecord[]) => {
			tell(`store ${records.length} durable work records`);
			return storeRecords(engine.fixture.host, records).pipe(Effect.provideContext(engine.running.context));
		},
	};
}

// A statement's distinct placeholders count the values it binds, such as the work ids in a child-table filter.
function boundQuery(text: string) {
	return { parameters: new Set(text.match(/\$\d+/gu)).size, text };
}
