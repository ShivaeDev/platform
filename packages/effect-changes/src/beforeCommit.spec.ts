import { Effect } from "effect";
import { expect, it } from "vitest";
import { makeChannel } from "#channel.ts";
import { Current, change, harness, makeDatabase, on } from "#test/fake-database.ts";

it("the root hook sees deduplicated committed children inside the native transaction", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const database = makeDatabase("main");
			const hooks: string[][] = [];
			const { channel, inTransaction, write, published } = harness({
				beforeCommit: (changes) =>
					Effect.gen(function* () {
						expect(database.committed).toEqual([]);
						hooks.push(changes.map((entry) => entry.subject));
						yield* database.write("hook");
					}),
			});
			yield* Effect.gen(function* () {
				yield* write(database, "a", change("a"));
				yield* write(database, "b", change("b"), change("a")).pipe(inTransaction(database), channel.batch);
				yield* Effect.andThen(write(database, "c", change("c")), Effect.fail("rollback")).pipe(inTransaction(database), Effect.ignore);
			}).pipe(inTransaction(database));
			expect(hooks).toEqual([["a", "b"]]);
			expect(database.committed).toEqual(["a", "b", "hook"]);
			expect(published).toEqual([["a:orders", "b:orders"]]);
		}),
	));

it("a typed hook failure rolls back the write and publishes nothing", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const database = makeDatabase("main");
			const published: string[] = [];
			const channel = makeChannel<string, Current, "notify failed">({
				beforeCommit: () => Effect.fail("notify failed"),
				name: "failing",
				owner: Effect.service(Current),
				publish: (keys) => Effect.sync(() => published.push(...keys)),
			});
			const failure = yield* Effect.andThen(database.write("row"), channel.record(["row"])).pipe(
				channel.within(database.transaction),
				on(database),
				Effect.flip,
			);
			expect(failure).toBe("notify failed");
			expect(database.committed).toEqual([]);
			expect(published).toEqual([]);
		}),
	));

it("empty transactions, failed bodies and unframed records never run the hook", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			let calls = 0;
			const database = makeDatabase("main");
			const { channel, inTransaction, write } = harness({
				beforeCommit: () =>
					Effect.sync(() => {
						calls += 1;
					}),
			});
			yield* Effect.void.pipe(inTransaction(database));
			yield* Effect.andThen(write(database, "row", change("a")), Effect.fail("rollback")).pipe(inTransaction(database), Effect.ignore);
			yield* write(database, "autocommit", change("b"));
			yield* channel.batch(write(database, "batch", change("c"))).pipe(on(database));
			expect(calls).toBe(0);
		}),
	));
