import { BigDecimal, Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
export class Payment extends Model.Class<Payment>("PostgresPayment")({
	amount: Schema.BigDecimalFromString,
	"created_at": Model.Field({ json: Schema.DateFromString, select: Schema.Date }),
	"due_on": Schema.String,
	id: Model.Field({
		json: Schema.Number,
		select: Schema.Number,
		update: Schema.Number,
	}),
	"local_time": Schema.Date,
	note: Schema.NullOr(Schema.String),
	sequence: Schema.BigInt,
	"settled_at": Schema.Date,
}) {}
export class Receipt extends Model.Class<Receipt>("PostgresReceipt")({
	details: Schema.Struct({ attempts: Schema.Int, channel: Schema.String }),
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
}) {}
export const setup = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_codecs_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* sql`create table ${sql(tableName)} (
		id integer generated always as identity primary key,
		amount numeric(36, 12) not null,
		sequence int8 not null,
		due_on date not null,
		settled_at timestamptz not null,
		local_time timestamp without time zone not null,
		note text,
		created_at timestamptz not null default current_timestamp
	)`;
	yield* Effect.addFinalizer(() => sql`drop table ${sql(tableName)}`.pipe(Effect.orDie));
	const payments = yield* makeRepository(Payment, {
		idColumn: "id",
		spanPrefix: "PostgresPayment",
		tableName,
	});
	return { payments, sql, tableName };
});
export const input = {
	amount: BigDecimal.fromStringUnsafe("9007199254740993.123456789012"),
	"due_on": "2026-09-30",
	"local_time": new Date("2026-09-19T10:11:12.345Z"),
	note: null,
	sequence: 9007199254740993n,
	"settled_at": new Date("2026-09-19T10:11:12.345Z"),
};
