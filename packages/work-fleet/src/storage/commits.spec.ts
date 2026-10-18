import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CommittedSink, transact } from "@shivaedev/effect-sql/transact.ts";
import { record } from "#test/storage.ts";
import { isolatedStorage } from "#test/storageStory.ts";

const test = isolatedStorage;

test.it("record and foreign occupancy writes announce their transaction commits", [], function* ({ namespace, store }) {
	const hints: (readonly unknown[])[] = [];
	yield* Effect.gen(function* () {
		const saved = yield* store.insert(record("one"));
		yield* store.compareAndSet("one", saved.version, { ...saved.value, stage: "running" });
		yield* store.reserveForeign("external");
		yield* store.reserveForeign("external", { backlog: true, executing: false });
		yield* store.releaseForeign("external");
	}).pipe(Effect.provideService(CommittedSink, (changes) => Effect.sync(() => hints.push(changes))));
	const records = `${namespace}_records`;
	const reservations = `${namespace}_foreign_reservations`;
	expect(hints).toEqual([
		[records, `${records}:one`, "fleet:one", "fleet"],
		[records, `${records}:one`, "fleet:one", "fleet"],
		[reservations, `${reservations}:external`, "fleet"],
		[reservations, `${reservations}:external`, "fleet"],
		[reservations, `${reservations}:external`, "fleet"],
	]);
});

test.it("a rolled-back record write announces no contract keys", [], function* ({ store }) {
	const hints: (readonly unknown[])[] = [];
	const result = yield* transact(store.insert(record("one")).pipe(Effect.andThen(Effect.fail("rollback"))), {
		onSqlError: (error) => error,
	}).pipe(
		Effect.provideService(CommittedSink, (changes) => Effect.sync(() => hints.push(changes))),
		Effect.flip,
	);
	expect(result).toBe("rollback");
	expect(yield* store.load("one")).toBeUndefined();
	expect(hints).toEqual([]);
});
