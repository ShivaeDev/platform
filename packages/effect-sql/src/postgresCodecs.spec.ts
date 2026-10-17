import * as PgClient from "@effect/sql-pg/PgClient";
import { BigDecimal, Effect, Redacted, Schema, type Scope } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { SqlError } from "effect/sql/SqlError";
import { expect, expectTypeOf, test, vi } from "vitest";
import { makeRepository } from "#repository.ts";
import { environmentVariable } from "#test/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
const integration = databaseUrl === undefined ? test.skip : test;

class Payment extends Model.Class<Payment>("PostgresPayment")({
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

class Receipt extends Model.Class<Receipt>("PostgresReceipt")({
	details: Schema.Struct({ attempts: Schema.Int, channel: Schema.String }),
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
}) {}

function run<A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient | Scope.Scope>) {
	return Effect.runPromise(
		Effect.scoped(effect).pipe(
			Effect.provide(
				PgClient.layer({
					url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
				}),
			),
		),
	);
}

const setup = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `platform_codecs_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* sql`create temporary table ${sql(tableName)} (
		id integer generated always as identity primary key,
		amount numeric(36, 12) not null,
		sequence int8 not null,
		due_on date not null,
		settled_at timestamptz not null,
		local_time timestamp without time zone not null,
		note text,
		created_at timestamptz not null default current_timestamp
	) on commit drop`;
	const payments = yield* makeRepository(Payment, {
		idColumn: "id",
		spanPrefix: "PostgresPayment",
		tableName,
	});
	return { payments, sql, tableName };
});

const input = {
	amount: BigDecimal.fromStringUnsafe("9007199254740993.123456789012"),
	"due_on": "2026-09-30",
	"local_time": new Date("2026-09-19T10:11:12.345Z"),
	note: null,
	sequence: 9007199254740993n,
	"settled_at": new Date("2026-09-19T10:11:12.345Z"),
};

integration("PostgreSQL model codecs round-trip precise numeric, int8, dates and generated fields", async () => {
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
					expect(inserted.sequence).toBe(9007199254740993n);
					expect(inserted.due_on).toBe("2026-09-30");
					expect(inserted.settled_at.toISOString()).toBe(input.settled_at.toISOString());
					expect(inserted.local_time.toISOString()).toBe(input.local_time.toISOString());
					expect(inserted.note).toBeNull();
					const selected = yield* payments.findMany({
						select: ["amount", "sequence"],
						where: { amount: input.amount, note: null },
					});
					expectTypeOf(selected).toEqualTypeOf<
						Array<{
							readonly amount: BigDecimal.BigDecimal;
							readonly sequence: bigint;
						}>
					>();
					expect(selected.map((row) => ({ amount: BigDecimal.format(row.amount), sequence: row.sequence }))).toEqual([
						{ amount: "9007199254740993.123456789012", sequence: 9007199254740993n },
					]);
					const updated = yield* payments.update({ ...inserted, "due_on": "2026-10-31", note: "verified", sequence: 9007199254740995n });
					expect(updated.sequence).toBe(9007199254740995n);
					expect((yield* payments.findById(inserted.id)).note).toBe("verified");
					expect(yield* sql`select amount::text as amount, sequence::text as sequence, due_on::text as due_on from ${sql(tableName)}`).toEqual([
						{ amount: "9007199254740993.123456789012", "due_on": "2026-10-31", sequence: "9007199254740995" },
					]);
				}),
			);
		}),
	);
});

integration("a plain object written to a JSON column fails with a typed SqlError and writes nothing", async () => {
	await run(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const tableName = `platform_receipts_${crypto.randomUUID().replaceAll("-", "")}`;
			yield* Effect.acquireRelease(
				sql`create table ${sql(tableName)} (id integer generated always as identity primary key, details jsonb not null)`,
				() => sql`drop table ${sql(tableName)}`.pipe(Effect.orDie),
			);
			const receipts = yield* makeRepository(Receipt, { idColumn: "id", spanPrefix: "PostgresReceipt", tableName });
			const failure = yield* receipts.insert({ details: { attempts: 1, channel: "card" } }).pipe(Effect.flip);
			const rows = yield* sql`select id from ${sql(tableName)}`;
			expect(failure).toBeInstanceOf(SqlError);
			expect(rows).toEqual([]);
		}),
	);
});

integration("schema failure from a persisted value rolls back the enclosing transaction", async () => {
	await run(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql.withTransaction(
				Effect.gen(function* () {
					const { payments, tableName } = yield* setup;
					const inserted = yield* payments.insert(input);
					const invalidNumericProgram = Effect.gen(function* () {
						yield* sql`update ${sql(tableName)} set amount = 'NaN'::numeric, note = 'rejected' where id = ${inserted.id}`;
						return yield* payments.findMany({ select: ["amount"] });
					});
					const invalidNumeric = yield* sql.withTransaction(invalidNumericProgram).pipe(Effect.result);
					expect(invalidNumeric._tag).toBe("Failure");
					if (invalidNumeric._tag === "Failure") {
						expect(Schema.isSchemaError(invalidNumeric.failure)).toBe(true);
					}
					const restored = yield* payments.findById(inserted.id);
					expect(BigDecimal.format(restored.amount)).toBe("9007199254740993.123456789012");
					expect(restored.note).toBeNull();
				}),
			);
		}),
	);
});

integration("timestamp without time zone is read and written as UTC wall time with millisecond precision", async () => {
	// A non-UTC process zone separates UTC wall time from local wall time; Vitest forks give this file its own process.
	vi.stubEnv("TZ", "America/New_York");
	try {
		await run(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql.withTransaction(
					Effect.gen(function* () {
						const { payments, tableName } = yield* setup;
						expect(input.local_time.getTimezoneOffset()).toBe(240);
						const inserted = yield* payments.insert(input);
						expect(yield* sql`select local_time::text as stored from ${sql(tableName)}`).toEqual([{ stored: "2026-09-19 10:11:12.345" }]);
						yield* sql`update ${sql(tableName)} set
							settled_at = '2026-09-19 12:11:12.345678+02'::timestamptz,
							local_time = '2026-09-19 10:11:12.345678'::timestamp
							where id = ${inserted.id}`;
						const decoded = yield* payments.findById(inserted.id);
						expect(decoded.settled_at.toISOString()).toBe("2026-09-19T10:11:12.345Z");
						expect(decoded.local_time.toISOString()).toBe("2026-09-19T10:11:12.345Z");
						expect(yield* sql`select to_char(settled_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') as precise from ${sql(tableName)}`).toEqual([
							{ precise: "2026-09-19 10:11:12.345678" },
						]);
					}),
				);
			}),
		);
	} finally {
		vi.unstubAllEnvs();
	}
});
