import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted } from "effect";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { recordModel } from "#storage/model.ts";
import { StorageRecord, storageDatabaseUrl } from "#test/storage.ts";

export function competingStorage(namespace: string) {
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
	}).pipe(Effect.provide(PgClient.layer({ url: Redacted.make(storageDatabaseUrl ?? "postgresql://integration-tests-disabled") })));
	return makePostgresFleetStore(StorageRecord, {
		admission: (_record, previous) => (previous === undefined || !intervene ? Effect.void : competingWrite.pipe(Effect.orDie)),
		namespace,
	});
}
