import { Context, Effect } from "effect";
import { expect } from "vitest";
import { Current, change } from "#test/fakeDatabase.ts";
import { beforeCommitWrites, changes, configured, countsHooks } from "#test/kit.ts";

const HookValue = Context.Reference<string>("BeforeCommitTest/HookValue", { defaultValue: () => "default" });

changes.it(
	"the hook preserves transaction-scoped services while supplying captured dependencies",
	[configured({ beforeCommit: () => Effect.flatMap(HookValue, (value) => Effect.flatMap(Current, (owner) => owner.write(value))) })],
	function* ({ database, open, record, published }) {
		const frame = yield* open().pipe(Effect.provideService(HookValue, "outer"));
		yield* frame.provide(record([change("body")]));
		yield* frame.beforeCommit.pipe(Effect.provideService(HookValue, "transaction"));
		yield* frame.settle("committed");
		expect(database.committed).toEqual(["transaction"]);
		expect(published).toEqual([["body:orders"]]);
	},
);

changes.it(
	"the root hook sees deduplicated committed children inside the native transaction",
	[beforeCommitWrites()],
	function* ({ hooks, inTransaction, write, database, batch, published, rollback }) {
		yield* Effect.gen(function* () {
			yield* write(database, "a", change("a"));
			yield* write(database, "b", change("b"), change("a")).pipe(inTransaction(database), batch);
			yield* Effect.andThen(write(database, "c", change("c")), rollback()).pipe(inTransaction(database), Effect.ignore);
		}).pipe(inTransaction(database));
		expect(hooks).toEqual([["a", "b"]]);
		expect(database.committed).toEqual(["a", "b", "hook"]);
		expect(published).toEqual([["a:orders", "b:orders"]]);
	},
);

changes.it(
	"a typed hook failure rolls back the write and publishes nothing",
	[configured({ beforeCommit: () => Effect.fail("notify failed") })],
	function* ({ database, write, inTransaction, published }) {
		const failure = yield* write(database, "row", change("row")).pipe(inTransaction(database), Effect.flip);
		expect(failure).toBe("notify failed");
		expect(database.committed).toEqual([]);
		expect(published).toEqual([]);
	},
);

changes.it(
	"empty transactions, failed bodies and unframed records never run the hook",
	[countsHooks()],
	function* ({ database, inTransaction, write, batch, hooks, rollback }) {
		yield* Effect.void.pipe(inTransaction(database));
		yield* Effect.andThen(write(database, "row", change("a")), rollback()).pipe(inTransaction(database), Effect.ignore);
		yield* write(database, "autocommit", change("b"));
		yield* batch(write(database, "batch", change("c")));
		expect(hooks).toEqual([]);
	},
);

changes.it(
	"a scoped BeforeCommit replaces the configured hook and the direct frame exposes it",
	[beforeCommitWrites()],
	function* ({ database, write, inTransaction, hooks, scopedHook, record, open, published }) {
		yield* write(database, "row", change("a")).pipe(inTransaction(database), Effect.provide(scopedHook));
		expect(database.committed).toEqual(["row"]);
		expect(hooks).toEqual([["a:orders"]]);
		const frame = yield* open().pipe(Effect.provide(scopedHook));
		yield* frame.provide(record([change("b")]));
		yield* frame.beforeCommit;
		yield* frame.settle("committed");
		expect(hooks).toEqual([["a:orders"], ["b:orders"]]);
		expect(published).toEqual([["a:orders"], ["b:orders"]]);
	},
);
