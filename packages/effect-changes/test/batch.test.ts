import { Deferred, Effect, Fiber } from "effect";
import { expect, it } from "vitest";
import { Current, change, harness, makeDatabase, on } from "./support/fake-database.ts";

it("a batch publishes its distinct changes once when it ends, whatever its exit, because its writes were autocommitted", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published, write } = harness();
			const database = makeDatabase("main");
			yield* Effect.gen(function* () {
				yield* write(database, "a", change("ada"));
				yield* write(database, "b", change("bob"), change("ada"));
				expect(published).toEqual([]);
			}).pipe(channel.batch, on(database));
			expect(published).toEqual([["ada:orders", "bob:orders"]]);

			const failed = yield* Effect.andThen(write(database, "c", change("cyd")), Effect.fail("rejected")).pipe(
				channel.batch,
				on(database),
				Effect.flip,
			);
			expect(failed).toBe("rejected");
			expect(published[1]).toEqual(["cyd:orders"]);

			const entered = yield* Deferred.make<void>();
			const fiber = yield* Effect.andThen(
				write(database, "d", change("dan")),
				Effect.andThen(Deferred.succeed(entered, undefined), Effect.never),
			).pipe(channel.batch, on(database), Effect.forkChild);
			yield* Deferred.await(entered);
			yield* Fiber.interrupt(fiber);
			expect(published[2]).toEqual(["dan:orders"]);
			expect(database.committed).toEqual(["a", "b", "c", "d"]);
		}),
	));

it("transactions inside a batch merge into it on commit and are discarded on rollback", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published, inTransaction, write } = harness();
			const database = makeDatabase("main");
			yield* Effect.gen(function* () {
				yield* write(database, "bare", change("ada"));
				yield* write(database, "committed", change("bob")).pipe(inTransaction(database));
				expect(published).toEqual([]);
				yield* Effect.andThen(write(database, "rolled back", change("cyd")), Effect.fail("rejected")).pipe(inTransaction(database), Effect.ignore);
			}).pipe(channel.batch, on(database));
			expect(published).toEqual([["ada:orders", "bob:orders"]]);
			expect(database.committed).toEqual(["bare", "committed"]);
		}),
	));

it("a batch does not own a transaction, so records in it and transactions opened in it still run the unowned guard", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const guarded: string[] = [];
			const unowned = Effect.map(Effect.service(Current), (database) => {
				guarded.push(database.name);
			});
			const { channel, published, inTransaction, write } = harness({ unowned });
			const database = makeDatabase("main");
			yield* Effect.gen(function* () {
				yield* write(database, "bare", change("ada"));
				yield* Effect.gen(function* () {
					yield* write(database, "outer", change("bob"));
					yield* write(database, "inner", change("cyd")).pipe(inTransaction(database));
				}).pipe(inTransaction(database));
			}).pipe(channel.batch, on(database));
			expect(guarded).toEqual(["main", "main"]);
			expect(published).toEqual([["ada:orders", "bob:orders", "cyd:orders"]]);
		}),
	));

it("a batch inside a transaction merges into it on any exit and follows the transaction's fate", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const { channel, published, inTransaction, write } = harness();
			const database = makeDatabase("main");
			const rolledBack = yield* Effect.gen(function* () {
				yield* write(database, "a", change("ada")).pipe(channel.batch);
				return yield* Effect.fail("rejected");
			}).pipe(inTransaction(database), Effect.flip);
			expect(rolledBack).toBe("rejected");
			expect(published).toEqual([]);

			yield* Effect.andThen(write(database, "b", change("bob")), Effect.fail("caught")).pipe(channel.batch, Effect.ignore, inTransaction(database));
			expect(published).toEqual([["bob:orders"]]);
			expect(database.committed).toEqual(["b"]);
		}),
	));
