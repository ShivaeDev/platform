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
				const reads = observedReads(engine);
				tell("record every SQL statement the daemon runs meanwhile");
				const before = reads.statements().length;
				return Effect.map(effect, (value) => ({ queries: reads.statements().slice(before).map(boundQuery), value }));
			}),
		// RPC propagates the caller's trace, so the daemon's statements for these requests share its trace id and background work does not.
		requestQueries: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			Effect.gen(function* () {
				const reads = observedReads(engine);
				tell("record the SQL statements the daemon runs for these requests");
				const { traceId } = yield* Effect.orDie(Effect.currentSpan);
				const value = yield* effect;
				return { queries: reads.statements(traceId).map(boundQuery), value };
			}).pipe(Effect.withSpan("HostStory.requestQueries")),
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

function observedReads(engine: HostStoryEngine) {
	if (engine.reads === undefined) {
		throw new Error("Deploy the host before reading its queries");
	}
	return engine.reads;
}

// A statement's distinct placeholders count the values it binds, such as the work ids in a child-table filter.
function boundQuery(text: string) {
	return { parameters: new Set(text.match(/\$\d+/gu)).size, text };
}
