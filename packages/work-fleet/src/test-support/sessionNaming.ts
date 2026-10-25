import { Effect, Layer } from "effect";
import { FleetRepository, fleetSessionJournal, postgresFleetRepository } from "#engine/repository.ts";
import { SessionJournal } from "#session/service.ts";
import { engine } from "#test/engineStory.ts";
import { namedAttempt, namedRecord } from "#test/namedCloudHost.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

export interface SessionNaming {
	journal: typeof SessionJournal.Service;
	lists: number;
	loads: string[];
	store: typeof FleetRepository.Service;
}

export function sessionNaming(count: number) {
	return engine.trait("configuration", `the naming journal shares PostgreSQL with ${count} Fleet records`, function* (state) {
		const store = yield* FleetRepository.pipe(Effect.provide(postgresFleetRepository(STORAGE_NAMESPACE)));
		for (let index = 0; index < count; index += 1) {
			yield* store.insert(namedRecord(`synthetic-${index}`, index === 0 ? [namedAttempt("worker")] : []));
		}
		const loads: string[] = [];
		const observed = { lists: 0, loads };
		const instrumented = {
			...store,
			list: () =>
				Effect.sync(() => {
					observed.lists += 1;
				}).pipe(Effect.andThen(store.list())),
			load: (id: string) =>
				Effect.sync(() => {
					observed.loads.push(id);
				}).pipe(Effect.andThen(store.load(id))),
		};
		const journal = yield* SessionJournal.pipe(Effect.provide(fleetSessionJournal.pipe(Layer.provide(Layer.succeed(FleetRepository)(instrumented)))));
		state.recovery.naming = {
			journal,
			get lists() {
				return observed.lists;
			},
			loads: observed.loads,
			store,
		};
	});
}
