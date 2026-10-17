import { Deferred, Effect, Fiber, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { FleetRecord } from "#model.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { recordModel } from "#storage/model.ts";
import { readRecords } from "#storage/readRecords.ts";
import { recordShape } from "#storage/recordShape.ts";
import { recordValue } from "#storage/recordValue.ts";
import { migrateFleet } from "#test/migrateFleet.ts";
import { postgresTests } from "#test/postgres.ts";
import { typedMigrationRecords } from "#test/typedMigrationRecords.ts";

const snapshotTests = postgresTests("live", "isolated", { maxConnections: 3 });

snapshotTests("a reader keeps one record version while a concurrent writer replaces root fields and children", function* () {
	const sql = yield* SqlClient.SqlClient;
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
	const writer = yield* store
		.compareAndSet(value.workId, saved.version, { ...saved.value, attempts: [], history: [], prompt: "changed" })
		.pipe(Effect.forkChild);
	yield* sql<{ readonly waiting: number }>`select count(*)::integer as waiting from pg_locks
		where locktype = 'advisory' and not granted and database = (select oid from pg_database where datname = current_database())`.pipe(
		Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (rows) => rows[0]?.waiting === 1 }),
		Effect.timeout("5 seconds"),
	);
	yield* Deferred.succeed(resume, undefined);
	expect(yield* Fiber.join(reader)).toEqual(saved.value);
	const updated = yield* Fiber.join(writer);
	expect(yield* store.load(value.workId)).toEqual(updated);
});
