import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { FleetRecord } from "#model.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { recordColumns } from "#storage/model.ts";
import { modelTableMigrations } from "#test/modelTableMigrations.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

const test = postgresTests("live", "isolated");

test("existing model tables gain every Fleet schema column and persist release reasons", function* () {
	const sql = yield* SqlClient.SqlClient;
	const namespace = "fleet_upgrade";
	const table = `${namespace}_records`;
	yield* migratePostgres({ loader: modelTableMigrations(namespace), lockTimeout: "5 seconds", table: `${namespace}_migrations` });
	const before = yield* sql<{ readonly name: string }>`
			select attname as name from pg_attribute where attrelid = ${table}::regclass and attnum > 0 and not attisdropped`;
	expect(before.map((column) => column.name)).not.toContain("releaseReason");
	const value: FleetRecord = {
		attempts: [],
		boardRevision: "revision",
		cwd: "/synthetic",
		preparation: prepared(),
		prompt: "Synthetic upgrade work",
		stage: "prepared",
		workId: "upgrade",
	};
	yield* sql`insert into ${sql(table)} (work_id, version, attempts, "boardRevision", cwd, preparation, prompt, stage)
			values (${value.workId}, 3, '[]', ${value.boardRevision}, ${value.cwd}, ${JSON.stringify(value.preparation)}, ${value.prompt}, ${value.stage})`;
	const store = yield* makePostgresFleetStore(FleetRecord, { namespace });
	yield* store.initialize();
	const after = yield* sql<{ readonly name: string }>`
			select attname as name from pg_attribute where attrelid = ${table}::regclass and attnum > 0 and not attisdropped`;
	expect(after.map((column) => column.name).sort()).toEqual(["admission_order", "version", "work_id", ...Object.keys(recordColumns())].sort());
	expect(yield* store.load(value.workId)).toEqual({ value, version: 4 });
	const released = { ...value, releaseReason: "Work is no longer approved", stage: "released" } satisfies FleetRecord;
	const saved = yield* store.compareAndSet(value.workId, 4, released);
	expect(saved).toEqual({ value: released, version: 5 });
	expect(yield* store.load(value.workId)).toEqual(saved);
	const inserted = yield* store.insert({ ...released, workId: "new" });
	expect(yield* store.list()).toEqual([saved, inserted]);
	expect(yield* store.initialize()).toEqual([]);
	expect(yield* store.list()).toEqual([saved, inserted]);
});
