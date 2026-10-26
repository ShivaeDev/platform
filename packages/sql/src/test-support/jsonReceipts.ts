import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
import { Receipt } from "./postgresCodecs.ts";

export const jsonReceipts = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_receipts_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.acquireRelease(
		sql`create table ${sql(tableName)} (id integer generated always as identity primary key, details jsonb not null)`,
		() => sql`drop table ${sql(tableName)}`.pipe(Effect.orDie),
	);
	const receipts = yield* makeRepository(Receipt, { idColumn: "id", spanPrefix: "PostgresReceipt", tableName });
	return { receipts, tableName };
});
