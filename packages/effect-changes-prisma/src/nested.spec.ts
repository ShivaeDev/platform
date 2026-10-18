import { Data, Effect } from "effect";
import { expect } from "vitest";
import { postgresEnabled } from "#test/database.ts";
import { prisma } from "#test/prisma.ts";
import { postgres } from "#test/prismaTraits.ts";

class Rejected extends Data.TaggedError("Rejected") {}

prisma.it.runIf(postgresEnabled)(
	"a nested $transaction merges into its parent on release and is discarded on rollback",
	[postgres()],
	function* ({ database: { changes, published, order, orders } }) {
		yield* Effect.gen(function* () {
			yield* order("o1", "ada");
			yield* order("o2", "bob").pipe(changes.transaction);
			expect(published).toEqual([]);
			const failed = yield* Effect.flip(Effect.andThen(order("o3", "cyd"), Effect.fail(new Rejected())).pipe(changes.transaction));
			expect(failed).toEqual(new Rejected());
			yield* order("o4", "ada");
		}).pipe(changes.transaction);
		expect(yield* orders()).toEqual(["o1", "o2", "o4"]);
		expect(published).toEqual([["ada:orders", "bob:orders"]]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a nested transaction that commits is still discarded when its parent rolls back",
	[postgres()],
	function* ({ database: { changes, published, orders } }) {
		const exit = yield* Effect.exit(
			Effect.andThen(
				changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } })).pipe(changes.transaction),
				Effect.fail(new Rejected()),
			).pipe(changes.transaction),
		);
		expect(exit._tag).toBe("Failure");
		expect(yield* orders()).toEqual([]);
		expect(published).toEqual([]);
	},
);

prisma.it.runIf(postgresEnabled)(
	"a transaction inside a frame-less native transaction is a root and publishes when its savepoint is released",
	[postgres()],
	function* ({ database: { client, changes, rollback } }) {
		const seen = yield* rollback(changes.use((db) => db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } })).pipe(changes.transaction));
		expect(seen).toEqual([["ada:orders"]]);
		expect(yield* Effect.promise(() => client.order.count())).toBe(0);
	},
);
