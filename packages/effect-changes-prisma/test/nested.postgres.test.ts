import { Data, Effect } from "effect";
import { expect } from "vitest";
import { makeChanges } from "#test/support/changes.ts";
import { integration, makeDatabase, orderIds } from "#test/support/database.ts";

class Rejected extends Data.TaggedError("Rejected") {}

integration("a nested $transaction merges into its parent on release and is discarded on rollback", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				const order = (id: string, ownerId: string) => changes.use((db) => db.order.create({ data: { id, ownerId, total: 1 } }));
				yield* Effect.gen(function* () {
					yield* order("o1", "ada");
					yield* order("o2", "bob").pipe(changes.transaction);
					expect(published).toEqual([]);
					const failed = yield* Effect.flip(Effect.andThen(order("o3", "cyd"), Effect.fail(new Rejected())).pipe(changes.transaction));
					expect(failed).toEqual(new Rejected());
					yield* order("o4", "ada");
				}).pipe(changes.transaction);
				expect(yield* orderIds(observer)).toEqual(["o1", "o2", "o4"]);
				expect(published).toEqual([["ada:orders", "bob:orders"]]);
			}),
		),
	),
);

integration("a nested transaction that commits is still discarded when its parent rolls back", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client, observer } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				const exit = yield* Effect.exit(
					Effect.andThen(
						changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } })).pipe(changes.transaction),
						Effect.fail(new Rejected()),
					).pipe(changes.transaction),
				);
				expect(exit._tag).toBe("Failure");
				expect(yield* orderIds(observer)).toEqual([]);
				expect(published).toEqual([]);
			}),
		),
	),
);

integration("a transaction inside a frame-less native transaction is a root and publishes when its savepoint is released", () =>
	Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const { client } = yield* makeDatabase;
				const { changes, published } = makeChanges(client);
				const context = yield* Effect.context<never>();
				const seen = yield* Effect.promise(() =>
					client
						.$transaction(async (tx) => {
							const inside = changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } })).pipe(changes.transaction);
							await Effect.runPromiseWith(context)(Effect.provideService(inside, changes.Client, tx));
							const snapshot = published.map((batch) => [...batch]);
							throw new RolledBack(snapshot);
						})
						.catch((error: unknown) => (error instanceof RolledBack ? error.snapshot : [])),
				);
				expect(seen).toEqual([["ada:orders"]]);
				expect(yield* Effect.promise(() => client.order.count())).toBe(0);
			}),
		),
	),
);

class RolledBack {
	readonly snapshot: ReadonlyArray<readonly string[]>;

	constructor(snapshot: ReadonlyArray<readonly string[]>) {
		this.snapshot = snapshot;
	}
}
