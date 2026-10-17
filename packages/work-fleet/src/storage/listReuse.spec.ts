import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { postgresTests } from "#test/postgres.ts";
import { spanCounts } from "#test/spanCounts.ts";
import { makeTestStore, record, withStorage } from "#test/storage.ts";

const test = postgresTests("live");

test("an unchanged list reuses decoded records and rereads only rows another writer changed", () =>
	withStorage((store, namespace) =>
		Effect.gen(function* () {
			yield* store.insert(record("one"));
			const two = yield* store.insert(record("two"));
			const spans = spanCounts();
			expect((yield* spans.trace(store.list())).map(({ value }) => value.workId)).toEqual(["one", "two"]);
			expect(spans.count("FleetRow.recordValues")).toBe(1);
			spans.reset();
			yield* spans.trace(store.list());
			expect(spans.count("FleetRow.recordValues")).toBe(0);
			const other = yield* makeTestStore(namespace);
			const running = yield* other.compareAndSet("two", two.version, { ...two.value, stage: "running" });
			const listed = yield* spans.trace(store.list());
			expect(listed.map(({ value }) => value.stage)).toEqual(["prepared", "running"]);
			expect(listed[1]).toEqual(running);
			expect(spans.count("FleetRow.recordValues")).toBe(1);
		}),
	));

test("a list read inside a rolled-back write never serves that write after another writer commits the same version", () =>
	withStorage((store, namespace) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const one = yield* store.insert(record("one"));
			const rolledBack = yield* sql
				.withTransaction(
					Effect.gen(function* () {
						yield* store.compareAndSet("one", one.version, { ...one.value, stage: "running" });
						yield* store.list();
						return yield* Effect.fail("roll back");
					}),
				)
				.pipe(Effect.flip);
			expect(rolledBack).toBe("roll back");
			const other = yield* makeTestStore(namespace);
			const terminal = yield* other.compareAndSet("one", one.version, { ...one.value, stage: "terminal" });
			expect(yield* store.list()).toEqual([terminal]);
		}),
	));
