import { Effect } from "effect";
import { expect } from "vitest";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { record } from "#test/storage.ts";
import { storage } from "#test/storageStory.ts";

storage.it("Fleet writes and scope finalizers use the rollback fixture", [], function* ({ store }) {
	expect(yield* store.list()).toEqual([]);
	expect(yield* store.foreignReservations()).toEqual([]);
	yield* Effect.scoped(Effect.acquireRelease(store.insert(record("one")), () => Effect.orDie(store.reserveForeign("finalizer"))));
	expect((yield* store.list()).map(({ value }) => value.workId)).toEqual(["one"]);
	expect(yield* store.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: true, owner: "finalizer" }]);
});
storage.it("the next Fleet story retains prepared tables without preceding records or reservations", [], function* ({ store }) {
	expect(yield* store.list()).toEqual([]);
	expect(yield* store.foreignReservations()).toEqual([]);
	const saved = yield* store.insert(record("one"));
	expect(yield* store.load("one")).toEqual(saved);
});
storage.it(
	"a Fleet clone commits through another connection and leaves the rollback store untouched",
	[],
	function* ({ store, namespace, openStore, readCommittedRecord }) {
		yield* store.insert(record("outer"));
		yield* withIsolatedDatabase(
			Effect.gen(function* () {
				const clone = yield* openStore(namespace);
				expect(yield* clone.list()).toEqual([]);
				const saved = yield* clone.insert(record("committed"));
				expect(yield* readCommittedRecord(namespace, "committed")).toEqual(saved);
			}),
		);
		expect((yield* store.list()).map(({ value }) => value.workId)).toEqual(["outer"]);
	},
);
