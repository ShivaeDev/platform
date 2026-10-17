import { Data, Effect } from "effect";
import { expect } from "vitest";
import { prisma } from "#test/prisma.ts";

class Rejected extends Data.TaggedError("Rejected") {}

prisma.it(
	"a nested $transaction merges into its parent on release and is discarded on rollback",
	[],
	function* ({ published, transaction, order, orderIds }) {
		yield* Effect.gen(function* () {
			yield* order("o1", "ada");
			yield* order("o2", "bob").pipe(transaction);
			expect(published()).toEqual([]);
			const failed = yield* Effect.flip(Effect.andThen(order("o3", "cyd"), Effect.fail(new Rejected())).pipe(transaction));
			expect(failed).toEqual(new Rejected());
			yield* order("o4", "ada");
		}).pipe(transaction);
		expect(yield* orderIds()).toEqual(["o1", "o2", "o4"]);
		expect(published()).toEqual([["ada:orders", "bob:orders"]]);
	},
);

prisma.it(
	"a nested transaction that commits is still discarded when its parent rolls back",
	[],
	function* ({ published, use, transaction, orderIds }) {
		const exit = yield* Effect.exit(
			Effect.andThen(
				use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } })).pipe(transaction),
				Effect.fail(new Rejected()),
			).pipe(transaction),
		);
		expect(exit._tag).toBe("Failure");
		expect(yield* orderIds()).toEqual([]);
		expect(published()).toEqual([]);
	},
);

prisma.it(
	"a transaction inside a frame-less native transaction is a root and publishes when its savepoint is released",
	[],
	function* ({ client, changes, published, use, transaction }) {
		const context = yield* Effect.context<never>();
		const seen = yield* Effect.promise(() =>
			client
				.$transaction(async (tx) => {
					const inside = use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } })).pipe(transaction);
					await Effect.runPromiseWith(context)(Effect.provideService(inside, changes.Client, tx));
					const snapshot = published().map((batch) => [...batch]);
					throw new RolledBack(snapshot);
				})
				.catch((error: unknown) => {
					if (error instanceof RolledBack) {
						return error.snapshot;
					}
					throw error;
				}),
		);
		expect(seen).toEqual([["ada:orders"]]);
		expect(yield* Effect.promise(() => client.order.count())).toBe(0);
	},
);

class RolledBack {
	readonly snapshot: ReadonlyArray<readonly string[]>;

	constructor(snapshot: ReadonlyArray<readonly string[]>) {
		this.snapshot = snapshot;
	}
}
