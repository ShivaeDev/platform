import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { spanCounts } from "#test/spanCounts.ts";
import { makeTestStore, record } from "#test/storage.ts";
import { storage } from "#test/storageStory.ts";

const test = storage;

test.it("an unchanged list reuses decoded records and rereads only rows another writer changed", [], function* ({ store, namespace, openStore }) {
	yield* store.insert(record("one"));
	const two = yield* store.insert(record("two"));
	const spans = spanCounts();
	expect((yield* spans.trace(store.list())).map(({ value }) => value.workId)).toEqual(["one", "two"]);
	expect(spans.count("FleetRow.recordValues")).toBe(1);
	spans.reset();
	yield* spans.trace(store.list());
	expect(spans.count("FleetRow.recordValues")).toBe(0);
	const other = yield* openStore(namespace);
	const running = yield* other.compareAndSet("two", two.version, { ...two.value, step: "running" });
	const listed = yield* spans.trace(store.list());
	expect(listed.map(({ value }) => value.step)).toEqual(["queued", "running"]);
	expect(listed[1]).toEqual(running);
	expect(spans.count("FleetRow.recordValues")).toBe(1);
});

test.it(
	"a list read inside a rolled-back write never serves that write after another writer commits the same version",
	[],
	function* ({ store, namespace }) {
		const sql = yield* SqlClient.SqlClient;
		const one = yield* store.insert(record("one"));
		const rolledBack = yield* sql
			.withTransaction(
				Effect.gen(function* () {
					yield* store.compareAndSet("one", one.version, { ...one.value, step: "running" });
					yield* store.list();
					return yield* Effect.fail("roll back");
				}),
			)
			.pipe(Effect.flip);
		expect(rolledBack).toBe("roll back");
		const other = yield* makeTestStore(namespace);
		const terminal = yield* other.compareAndSet("one", one.version, { ...one.value, step: "terminal" });
		expect(yield* store.list()).toEqual([terminal]);
	},
);
