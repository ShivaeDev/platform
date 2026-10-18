import { Effect } from "effect";
import { expect } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { postgresTests } from "#test/postgres.ts";
import { makeTestStore, record, withStorage } from "#test/storage.ts";

const test = postgresTests("live");

test("Fleet writes and scope finalizers use the rollback fixture", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			expect(yield* store.list()).toEqual([]);
			expect(yield* store.foreignReservations()).toEqual([]);
			yield* Effect.acquireRelease(store.insert(record("one")), () => Effect.orDie(store.reserveForeign("finalizer")));
			expect((yield* store.list()).map(({ value }) => value.workId)).toEqual(["one"]);
		}),
	));

test("the next Fleet test retains the prepared tables without preceding records or reservations", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			expect(yield* store.list()).toEqual([]);
			expect(yield* store.foreignReservations()).toEqual([]);
			yield* store.insert(record("one"));
		}),
	));

const committedClone = withStorage((store, namespace) =>
	Effect.gen(function* () {
		expect(yield* store.list()).toEqual([]);
		const saved = yield* store.insert(record("committed"));
		const database = yield* PostgresTestDatabase;
		const observed = yield* makeTestStore(namespace).pipe(
			Effect.flatMap((reader) => reader.load("committed")),
			Effect.provide(hostDatabase(database.url, "work-fleet-isolation-reader", 1)),
		);
		expect(observed).toEqual(saved);
	}),
);

test("a Fleet clone commits through another connection and leaves the rollback store untouched", () =>
	withStorage((outer) =>
		Effect.gen(function* () {
			yield* outer.insert(record("outer"));
			yield* withIsolatedDatabase(committedClone);
			expect((yield* outer.list()).map(({ value }) => value.workId)).toEqual(["outer"]);
		}),
	));
