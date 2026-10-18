import { Deferred, Effect } from "effect";
import { expect } from "vitest";
import { change } from "#test/fakeDatabase.ts";
import { changes, guardsUnowned } from "#test/kit.ts";

changes.it(
	"a batch publishes its distinct changes once when it ends, whatever its exit, because its writes were autocommitted",
	[],
	function* ({ published, write, database, batch, interrupt, rollback }) {
		yield* Effect.gen(function* () {
			yield* write(database, "a", change("ada"));
			yield* write(database, "b", change("bob"), change("ada"));
			expect(published).toEqual([]);
		}).pipe(batch);
		expect(published).toEqual([["ada:orders", "bob:orders"]]);

		const failed = yield* Effect.andThen(write(database, "c", change("cyd")), rollback()).pipe(batch, Effect.flip);
		expect(failed).toBe("rejected");
		expect(published[1]).toEqual(["cyd:orders"]);

		const entered = yield* Deferred.make<void>();
		const fiber = yield* Effect.andThen(write(database, "d", change("dan")), Effect.andThen(Deferred.succeed(entered, undefined), Effect.never)).pipe(
			batch,
			Effect.forkChild,
		);
		yield* Deferred.await(entered);
		yield* interrupt(fiber);
		expect(published[2]).toEqual(["dan:orders"]);
		expect(database.committed).toEqual(["a", "b", "c", "d"]);
	},
);

changes.it(
	"transactions inside a batch merge into it on commit and are discarded on rollback",
	[],
	function* ({ published, inTransaction, write, database, batch, rollback }) {
		yield* Effect.gen(function* () {
			yield* write(database, "bare", change("ada"));
			yield* write(database, "committed", change("bob")).pipe(inTransaction(database));
			expect(published).toEqual([]);
			yield* Effect.andThen(write(database, "rolled back", change("cyd")), rollback()).pipe(inTransaction(database), Effect.ignore);
		}).pipe(batch);
		expect(published).toEqual([["ada:orders", "bob:orders"]]);
		expect(database.committed).toEqual(["bare", "committed"]);
	},
);

changes.it(
	"a batch does not own a transaction, so records in it and transactions opened in it still run the unowned guard",
	[guardsUnowned()],
	function* ({ guarded, published, inTransaction, write, database, batch }) {
		yield* Effect.gen(function* () {
			yield* write(database, "bare", change("ada"));
			yield* Effect.gen(function* () {
				yield* write(database, "outer", change("bob"));
				yield* write(database, "inner", change("cyd")).pipe(inTransaction(database));
			}).pipe(inTransaction(database));
		}).pipe(batch);
		expect(guarded).toEqual(["main", "main"]);
		expect(published).toEqual([["ada:orders", "bob:orders", "cyd:orders"]]);
	},
);

changes.it(
	"a batch inside a transaction merges into it on any exit and follows the transaction's fate",
	[],
	function* ({ published, inTransaction, write, database, batch, rollback }) {
		const rolledBack = yield* Effect.gen(function* () {
			yield* write(database, "a", change("ada")).pipe(batch);
			return yield* rollback();
		}).pipe(inTransaction(database), Effect.flip);
		expect(rolledBack).toBe("rejected");
		expect(published).toEqual([]);

		yield* Effect.andThen(write(database, "b", change("bob")), Effect.fail("caught")).pipe(batch, Effect.ignore, inTransaction(database));
		expect(published).toEqual([["bob:orders"]]);
		expect(database.committed).toEqual(["b"]);
	},
);
