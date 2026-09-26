import * as PgClient from "@effect/sql-pg/PgClient";
import { BigDecimal, Effect, Redacted, Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql";
import { expect, expectTypeOf, test } from "vitest";
import { makeRepository } from "../src/index.ts";
import { environmentVariable } from "./support/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;
const Details = Schema.Struct({ channel: Schema.String, attempts: Schema.Int });

class Payment extends Model.Class<Payment>("PostgresPayment")({
	id: Model.Field({
		select: Schema.Number,
		update: Schema.Number,
		json: Schema.Number,
	}),
	amount: Schema.BigDecimalFromString,
	settled_at: Schema.Date,
	local_time: Schema.Date,
	details: Details,
	details_json: Details,
	note: Schema.NullOr(Schema.String),
	created_at: Model.Field({ select: Schema.Date, json: Schema.DateFromString }),
}) {}

const run = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
	Effect.runPromise(
		effect.pipe(
			Effect.provide(
				PgClient.layer({
					url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
				}),
			),
		),
	);

const setup = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_codecs_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* sql`create temporary table ${sql(tableName)} (
		id integer generated always as identity primary key,
		amount numeric(36, 12) not null,
		settled_at timestamptz not null,
		local_time timestamp without time zone not null,
		details jsonb not null,
		details_json json not null,
		note text,
		created_at timestamptz not null default current_timestamp
	) on commit drop`;
	const payments = yield* makeRepository(Payment, {
		tableName,
		idColumn: "id",
		spanPrefix: "PostgresPayment",
	});
	return { sql, tableName, payments };
});

const input = {
	amount: BigDecimal.fromStringUnsafe("9007199254740993.123456789012"),
	settled_at: new Date("2026-09-19T10:11:12.345Z"),
	local_time: new Date(2026, 8, 19, 10, 11, 12, 345),
	details: { channel: "card", attempts: 2 },
	details_json: { channel: "import", attempts: 1 },
	note: null,
};

integration("PostgreSQL model codecs round-trip precise numeric, dates, JSON and generated fields", async () => {
	await run(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql.withTransaction(
				Effect.gen(function* () {
					const { payments, tableName } = yield* setup;
					const inserted = yield* payments.insert(input);
					expect(inserted).toBeInstanceOf(Payment);
					expect(inserted.id).toBe(1);
					expect(inserted.created_at).toBeInstanceOf(Date);
					expect(Number.isFinite(inserted.created_at.getTime())).toBe(true);
					expect(BigDecimal.format(inserted.amount)).toBe("9007199254740993.123456789012");
					expect(inserted.settled_at.toISOString()).toBe(input.settled_at.toISOString());
					expect(inserted.local_time.getTime()).toBe(input.local_time.getTime());
					expect(inserted.details).toEqual(input.details);
					expect(inserted.details_json).toEqual(input.details_json);
					expect(inserted.note).toBeNull();
					const selected = yield* payments.findMany({
						where: { amount: input.amount, note: null },
						select: ["amount", "details"],
					});
					expectTypeOf(selected).toEqualTypeOf<
						Array<{
							readonly amount: BigDecimal.BigDecimal;
							readonly details: typeof Details.Type;
						}>
					>();
					expect(
						selected.map((row) => ({
							amount: BigDecimal.format(row.amount),
							details: row.details,
						})),
					).toEqual([
						{
							amount: "9007199254740993.123456789012",
							details: input.details,
						},
					]);
					const updated = yield* payments.update({
						...inserted,
						details: { channel: "transfer", attempts: 3 },
						note: "verified",
					});
					expect(updated.details).toEqual({ channel: "transfer", attempts: 3 });
					expect((yield* payments.findById(inserted.id)).note).toBe("verified");
					expect(yield* sql`select amount::text as amount, jsonb_typeof(details) as kind from ${sql(tableName)}`).toEqual([
						{ amount: "9007199254740993.123456789012", kind: "object" },
					]);
				}),
			);
		}),
	);
});

integration("schema failure from persisted JSON rolls back the enclosing transaction", async () => {
	await run(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql.withTransaction(
				Effect.gen(function* () {
					const { payments, tableName } = yield* setup;
					const inserted = yield* payments.insert(input);
					const rejectedProgram = Effect.gen(function* () {
						yield* sql`update ${sql(tableName)} set details = '{"channel":"bad","attempts":"three"}'::jsonb where id = ${inserted.id}`;
						return yield* payments.findById(inserted.id);
					});
					const rejected = yield* sql.withTransaction(rejectedProgram).pipe(Effect.result);
					expect(rejected._tag).toBe("Failure");
					if (rejected._tag === "Failure") expect(Schema.isSchemaError(rejected.failure)).toBe(true);
					expect((yield* payments.findById(inserted.id)).details).toEqual(input.details);
					const invalidNumericProgram = Effect.gen(function* () {
						yield* sql`update ${sql(tableName)} set amount = 'NaN'::numeric where id = ${inserted.id}`;
						return yield* payments.findMany({ select: ["amount"] });
					});
					const invalidNumeric = yield* sql.withTransaction(invalidNumericProgram).pipe(Effect.result);
					expect(invalidNumeric._tag).toBe("Failure");
					if (invalidNumeric._tag === "Failure") expect(Schema.isSchemaError(invalidNumeric.failure)).toBe(true);
					expect(BigDecimal.format((yield* payments.findById(inserted.id)).amount)).toBe("9007199254740993.123456789012");
					const invalidReadProgram = Effect.gen(function* () {
						yield* sql`update ${sql(tableName)} set details = 'null'::jsonb where id = ${inserted.id}`;
						return yield* payments.findMany({ select: ["details"] });
					});
					const invalidRead = yield* sql.withTransaction(invalidReadProgram).pipe(Effect.result);
					expect(invalidRead._tag).toBe("Failure");
					if (invalidRead._tag === "Failure") expect(Schema.isSchemaError(invalidRead.failure)).toBe(true);
					expect((yield* payments.findById(inserted.id)).details).toEqual(input.details);
				}),
			);
		}),
	);
});

integration("default PostgreSQL timestamp decoding has millisecond precision and local wall-time semantics", async () => {
	await run(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql.withTransaction(
				Effect.gen(function* () {
					const { payments, tableName } = yield* setup;
					const inserted = yield* payments.insert(input);
					yield* sql`update ${sql(tableName)} set
				settled_at = '2026-09-19 12:11:12.345678+02'::timestamptz,
				local_time = '2026-09-19 10:11:12.345678'::timestamp
				where id = ${inserted.id}`;
					const decoded = yield* payments.findById(inserted.id);
					expect(decoded.settled_at.toISOString()).toBe("2026-09-19T10:11:12.345Z");
					expect(decoded.local_time.getTime()).toBe(new Date(2026, 8, 19, 10, 11, 12, 345).getTime());
					expect(yield* sql`select to_char(settled_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') as precise from ${sql(tableName)}`).toEqual([
						{ precise: "2026-09-19 10:11:12.345678" },
					]);
				}),
			);
		}),
	);
});
