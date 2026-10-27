import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
export class InvoiceLine extends Model.Class<InvoiceLine>("PostgresInvoiceLine")({
	amount: Schema.NumberFromString,
	id: Model.Field({
		json: Schema.Number,
		select: Schema.Number,
		update: Schema.Number,
	}),
	name: Schema.String,
	note: Schema.NullOr(Schema.String),
}) {}
export const invoiceLines = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_effect_sql_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(tableName)} (
						id integer generated always as identity primary key,
						name text not null,
						amount text not null,
						note text
					)`;
	const lines = yield* makeRepository(InvoiceLine, {
		idColumn: "id",
		spanPrefix: "PostgresInvoiceLine",
		tableName,
	});
	return { lines, tableName };
});
