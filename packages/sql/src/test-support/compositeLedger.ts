import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
export class LedgerEntry extends Model.Class<LedgerEntry>("LedgerEntry")({
	account: Schema.String,
	amount: Schema.String,
	sequence: Schema.BigInt,
}) {}
export const compositeLedger = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_effect_sql_ledger_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(tableName)} (
        account text not null, sequence bigint not null, amount text not null,
        primary key (account, sequence)
      )`;
	const entries = yield* makeRepository(LedgerEntry, {
		idColumn: ["account", "sequence"],
		spanPrefix: "LedgerEntry",
		tableName,
	});
	return { entries, tableName };
});
