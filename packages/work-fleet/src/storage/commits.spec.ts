import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CommittedSink, transact } from "@shivaedev/effect-sql/transact.ts";
import { postgresTests } from "#test/postgres.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";
import { record, withStorage } from "#test/storage.ts";

const test = postgresTests("live", "isolated");

test("record and foreign occupancy writes announce their transaction commits", () =>
	withStorage((store) =>
		Effect.gen(function* () {
			const hints: (readonly unknown[])[] = [];
			yield* Effect.gen(function* () {
				const saved = yield* store.insert(record("one"));
				yield* store.compareAndSet("one", saved.version, { ...saved.value, stage: "running" });
				yield* store.reserveForeign("external");
				yield* store.reserveForeign("external", { backlog: true, executing: false });
				yield* store.releaseForeign("external");
			}).pipe(Effect.provideService(CommittedSink, (changes) => Effect.sync(() => hints.push(changes))));
			const records = `${STORAGE_NAMESPACE}_records`;
			const reservations = `${STORAGE_NAMESPACE}_foreign_reservations`;
			expect(hints).toEqual([
				[records, `${records}:one`, "fleet:one", "fleet"],
				[records, `${records}:one`, "fleet:one", "fleet"],
				[reservations, `${reservations}:external`, "fleet"],
				[reservations, `${reservations}:external`, "fleet"],
				[reservations, `${reservations}:external`, "fleet"],
			]);
		}),
	));

test("a rolled-back record write announces no contract keys", () =>
	withStorage((store) =>
		Effect.gen(function* () {
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
		}),
	));
