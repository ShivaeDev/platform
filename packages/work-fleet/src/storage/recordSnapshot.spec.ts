import { Deferred, Effect, Fiber, Schedule } from "effect";
import { expect } from "vitest";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { FleetRecord } from "#model.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { recordModel } from "#storage/model.ts";
import { readRecordSnapshot, readRecords } from "#storage/readRecords.ts";
import { recordShape } from "#storage/recordShape.ts";
import { recordValue } from "#storage/recordValue.ts";
import { migrateFleet } from "#test/migrateFleet.ts";
import { postgresTests } from "#test/postgres.ts";
import { spanCounts } from "#test/spanCounts.ts";
import { typedMigrationRecords } from "#test/typedMigrationRecords.ts";

const snapshotTests = postgresTests("live", "isolated", { maxConnections: 3 });

snapshotTests("a reader keeps one record version while a concurrent writer replaces root fields and children", function* () {
	const namespace = "typed_snapshot";
	const store = yield* makePostgresFleetStore(FleetRecord, { namespace });
	yield* migrateFleet(namespace);
	const value = typedMigrationRecords()[0];
	if (value === undefined) {
		return yield* Effect.die("Missing populated fixture");
	}
	const saved = yield* store.insert(value);
	const repository = yield* makeRepository(recordModel(), { idColumn: "work_id", spanPrefix: "Snapshot", tableName: `${namespace}_records` });
	const entered = yield* Deferred.make<void>();
	const resume = yield* Deferred.make<void>();
	const reader = yield* readRecords(
		namespace,
		Effect.gen(function* () {
			const row = yield* repository.findById(value.workId);
			yield* Deferred.succeed(entered, undefined);
			yield* Deferred.await(resume);
			return yield* recordValue(row, recordShape(), namespace);
		}),
	).pipe(Effect.forkChild);
	yield* Deferred.await(entered);
	const spans = spanCounts();
	const writer = yield* store
		.compareAndSet(value.workId, saved.version, { ...saved.value, attempts: [], history: [], prompt: "changed" })
		.pipe(spans.trace, Effect.forkChild);
	yield* Effect.sync(() => spans.count("FleetStore.waitAdmission")).pipe(
		Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (count) => count > 0 }),
		Effect.timeout("5 seconds"),
	);
	yield* Deferred.succeed(resume, undefined);
	expect(yield* Fiber.join(reader)).toEqual(saved.value);
	const updated = yield* Fiber.join(writer);
	expect(yield* store.load(value.workId)).toEqual(updated);
});

snapshotTests("a receipt snapshot reads one committed root and children while an admission writer proceeds", function* () {
	const namespace = "receipt_snapshot";
	const store = yield* makePostgresFleetStore(FleetRecord, { namespace });
	yield* migrateFleet(namespace);
	const value = typedMigrationRecords()[0];
	if (value === undefined) {
		return yield* Effect.die("Missing populated fixture");
	}
	const saved = yield* store.insert(value);
	const repository = yield* makeRepository(recordModel(), { idColumn: "work_id", spanPrefix: "Snapshot", tableName: `${namespace}_records` });
	const entered = yield* Deferred.make<void>();
	const resume = yield* Deferred.make<void>();
	const reader = yield* readRecordSnapshot(
		Effect.gen(function* () {
			const row = yield* repository.findById(value.workId);
			yield* Deferred.succeed(entered, undefined);
			yield* Deferred.await(resume);
			return yield* recordValue(row, recordShape(), namespace);
		}),
	).pipe(Effect.forkChild);
	yield* Deferred.await(entered);
	const updated = yield* store.compareAndSet(value.workId, saved.version, { ...saved.value, attempts: [], history: [], prompt: "changed" });
	yield* Deferred.succeed(resume, undefined);
	expect(yield* Fiber.join(reader)).toEqual(saved.value);
	expect(yield* store.load(value.workId)).toEqual(updated);
});
