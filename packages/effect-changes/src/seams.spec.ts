import { Effect } from "effect";
import { expect } from "vitest";
import { change } from "#test/fake-database.ts";
import { changes, hasObserver, hasSink } from "#test/kit.ts";

changes.it(
	"a Layer swaps a channel's sink for its scope; the configured sink is untouched and resumes afterwards",
	[hasSink()],
	function* ({ published, inTransaction, write, database, record, open, captured, sink }) {
		yield* Effect.gen(function* () {
			yield* write(database, "row", change("ada")).pipe(inTransaction(database));
			yield* write(database, "bare row", change("bob"));
			const frame = yield* open();
			yield* frame.provide(record([change("cyd")]));
			yield* frame.settle("committed");
		}).pipe(Effect.provide(sink));
		expect(captured).toEqual([["ada:orders"], ["bob:orders"], ["cyd:orders"]]);
		expect(published).toEqual([]);

		yield* write(database, "later row", change("dan"));
		expect(published).toEqual([["dan:orders"]]);
	},
);

changes.it(
	"an observer sees every recorded change and whether it was published or discarded",
	[hasObserver()],
	function* ({ published, inTransaction, write, database, seen, observer, rollback }) {
		const rejected = rollback();
		yield* Effect.gen(function* () {
			yield* Effect.gen(function* () {
				yield* write(database, "a", change("ada"));
				yield* Effect.andThen(write(database, "b", change("bob")), rejected).pipe(inTransaction(database), Effect.ignore);
				yield* write(database, "c", change("cyd")).pipe(inTransaction(database));
			}).pipe(inTransaction(database));
			yield* Effect.gen(function* () {
				yield* write(database, "d", change("dan"));
				yield* write(database, "e", change("eve")).pipe(inTransaction(database));
				return yield* rejected;
			}).pipe(inTransaction(database), Effect.ignore);
			yield* write(database, "f", change("fay"), change("fay"));
		}).pipe(Effect.provide(observer));
		expect(seen).toEqual([
			"Recorded ada:orders",
			"Recorded bob:orders",
			"Discarded bob:orders",
			"Recorded cyd:orders",
			"Published ada:orders cyd:orders",
			"Recorded dan:orders",
			"Recorded eve:orders",
			"Discarded dan:orders eve:orders",
			"Recorded fay:orders",
			"Published fay:orders",
		]);
		expect(published).toEqual([["ada:orders", "cyd:orders"], ["fay:orders"]]);

		yield* write(database, "g", change("gus"));
		expect(seen).toHaveLength(10);
	},
);

changes.it(
	"CommittedSink replaces only transaction delivery",
	[hasSink()],
	function* ({ database, write, inTransaction, batch, committedSink, captured, published }) {
		yield* Effect.gen(function* () {
			yield* write(database, "transaction", change("ada")).pipe(inTransaction(database));
			yield* write(database, "bare", change("bob"));
			yield* write(database, "batch", change("cyd")).pipe(batch);
		}).pipe(Effect.provide(committedSink));
		expect(captured).toEqual([["ada:orders"]]);
		expect(published).toEqual([["bob:orders"], ["cyd:orders"]]);
	},
);

changes.it(
	"Published is observed before delivery begins",
	[hasSink(), hasObserver()],
	function* ({ database, write, inTransaction, observing, sink, timeline }) {
		yield* write(database, "row", change("ada")).pipe(inTransaction(database), observing, Effect.provide(sink));
		expect(timeline).toEqual(["Recorded ada:orders", "Published ada:orders", "Sink ada:orders"]);
	},
);
