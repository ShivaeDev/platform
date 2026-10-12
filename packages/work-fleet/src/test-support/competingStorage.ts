import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect } from "effect";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { recordModel } from "#storage/model.ts";
import { StorageRecord } from "#test/StorageRecord.ts";

export const competingStorage = Effect.fn("FleetFixture.competingStorage")(function* (namespace: string) {
	const database = yield* PostgresTestDatabase;
	let intervene = true;
	const competingWrite = Effect.gen(function* () {
		const repository = yield* makeRepository(recordModel(StorageRecord), {
			idColumn: "work_id",
			spanPrefix: "CompetingWriter",
			tableName: `${namespace}_records`,
			versionColumn: "version",
		});
		const original = yield* repository.findById("board-a");
		yield* repository.update({ ...original, stage: "running" });
		intervene = false;
	}).pipe(Effect.provide(PgClient.layer({ url: database.url })));
	return yield* makePostgresFleetStore(StorageRecord, {
		admission: (_record, previous) => (previous === undefined || !intervene ? Effect.void : competingWrite.pipe(Effect.orDie)),
		namespace,
	});
});
