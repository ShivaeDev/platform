import { Effect, Layer } from "effect";
import { FleetRepository, fleetSessionJournal } from "#engine/repository.ts";
import { FleetRecord } from "#model.ts";
import type { SessionJournal } from "#session/service.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { withStorage } from "#test/storage.ts";

type Store = Effect.Success<ReturnType<typeof makePostgresFleetStore<typeof FleetRecord>>>;

export function withOperationStorage<A, E>(use: (store: Store) => Effect.Effect<A, E, SessionJournal>) {
	return withStorage((_unused, namespace) =>
		Effect.gen(function* () {
			const store = yield* makePostgresFleetStore(FleetRecord, { namespace });
			return yield* use(store).pipe(Effect.provide(fleetSessionJournal.pipe(Layer.provide(Layer.succeed(FleetRepository)(store)))));
		}),
	);
}
