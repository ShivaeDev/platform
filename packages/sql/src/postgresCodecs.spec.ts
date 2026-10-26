import { BigDecimal, Effect, Schema } from "effect";
import { SqlError } from "effect/sql/SqlError";
import { expect, expectTypeOf } from "vitest";
import { input, Payment } from "#test/postgresCodecs.ts";
import { hasJsonReceipts } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasPayments, inTimezone } from "#test/sqlTraits.ts";
import { transaction } from "#test/transaction.ts";

postgres.it(
	"PostgreSQL model codecs round-trip precise numeric, int8, dates and generated fields",
	[hasPayments()],
	function* ({ paymentFixture, sql }) {
		const { payments, tableName } = paymentFixture();
		const inserted = yield* payments.insert(input);
		expect(inserted).toBeInstanceOf(Payment);
		expect(inserted).toMatchObject({ id: 1 });
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
	},
);

postgres.it(
	"a plain object written to a JSON column fails with a typed SqlError and writes nothing",
	[hasJsonReceipts()],
	function* ({ sql, jsonReceipts }) {
		const { receipts, tableName } = jsonReceipts();
		const failure = yield* receipts.insert({ details: { attempts: 1, channel: "card" } }).pipe(Effect.flip);
		const rows = yield* sql`select id from ${sql(tableName)}`;
		expect(failure).toBeInstanceOf(SqlError);
		expect(rows).toEqual([]);
	},
);

postgres.it("schema failure from a persisted value rolls back the enclosing transaction", [hasPayments()], function* ({ paymentFixture, sql }) {
	const { payments, tableName } = paymentFixture();
	const inserted = yield* payments.insert(input);
	const invalidNumericProgram = Effect.gen(function* () {
		yield* sql`update ${sql(tableName)} set amount = 'NaN'::numeric, note = 'rejected' where id = ${inserted.id}`;
		return yield* payments.findMany({ select: ["amount"] });
	});
	const invalidNumeric = yield* transaction(invalidNumericProgram).pipe(Effect.result);
	expect(invalidNumeric._tag).toBe("Failure");
	if (invalidNumeric._tag === "Failure") {
		expect(Schema.isSchemaError(invalidNumeric.failure)).toBe(true);
	}
	const restored = yield* payments.findById(inserted.id);
	expect(BigDecimal.format(restored.amount)).toBe("9007199254740993.123456789012");
	expect(restored.note).toBeNull();
});

postgres.it(
	"timestamp without time zone is read and written as UTC wall time with millisecond precision",
	[hasPayments(), inTimezone("America/New_York")],
	function* ({ paymentFixture, sql }) {
		yield* transaction(
			Effect.gen(function* () {
				const { payments, tableName } = paymentFixture();
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
	},
);
