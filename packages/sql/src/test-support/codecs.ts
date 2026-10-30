import { BigDecimal, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { transact } from "#transact.ts";
import { Payment, payment, Receipt, Sample } from "./codecModels.ts";
import { onPostgres } from "./engines.ts";
import { attempt, endingOf } from "./outcome.ts";
import { ownTable, records, uniqueTable } from "./writeTables.ts";

type PaymentInput = typeof Payment.insert.Type;
type Filter = NonNullable<NonNullable<Parameters<Effect.Success<ReturnType<typeof paymentRepository>>["count"]>[0]>["where"]>;
type Values = readonly number[];

function paymentRepository(tableName: string) {
	return makeRepository(Payment, { idColumn: "id", spanPrefix: "Payment", tableName });
}

const codecEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tables = { payments: uniqueTable("codec_payments"), receipts: uniqueTable("codec_receipts"), samples: uniqueTable("codec_samples") };
	yield* ownTable(
		sql,
		tables.payments,
		sql`id integer generated always as identity primary key, amount numeric(36, 12) not null, sequence int8 not null,
			due_on date not null, settled_at timestamptz not null, local_time timestamp without time zone not null, note text,
			created_at timestamptz not null default current_timestamp`,
	);
	yield* ownTable(sql, tables.receipts, sql`id integer generated always as identity primary key, details jsonb not null`);
	yield* ownTable(sql, tables.samples, sql`id integer primary key, values int4[] not null`);
	return {
		payments: yield* paymentRepository(tables.payments),
		receipts: yield* makeRepository(Receipt, { idColumn: "id", spanPrefix: "Receipt", tableName: tables.receipts }),
		records: records(),
		samples: yield* makeRepository(Sample, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Sample", tableName: tables.samples }),
		sql,
		tables,
	};
});

type CodecEngine = Effect.Success<ReturnType<typeof codecEngine>>;

function printed(row: Partial<Payment>) {
	return {
		...(row.amount === undefined ? {} : { amount: BigDecimal.format(row.amount) }),
		...(row.created_at === undefined ? {} : { createdAt: row.created_at instanceof Date ? "a database-generated date" : row.created_at }),
		...(row.due_on === undefined ? {} : { dueOn: row.due_on }),
		...(row.local_time === undefined ? {} : { localTime: row.local_time.toISOString() }),
		...(row.note === undefined ? {} : { note: row.note }),
		...(row.sequence === undefined ? {} : { sequence: row.sequence }),
		...(row.settled_at === undefined ? {} : { settledAt: row.settled_at.toISOString() }),
	};
}

function sampleRows(rows: readonly Sample[]) {
	return rows.map(({ id, values }) => ({ id, values }));
}

function codecVerbs({ payments, receipts, records: { endings, returned }, samples, sql, tables }: CodecEngine, tell: (line: string) => void) {
	function returning<A>(result: A) {
		returned.push(result);
	}
	function recorded(ending: string) {
		endings.push(ending);
		return ending;
	}
	function samplesWritten(write: string, rows: ReadonlyArray<{ readonly id: number; readonly values: Values }>) {
		tell(`${write} writes ${rows.map(({ id, values }) => `sample ${id} with [${values.join(", ")}]`).join(" and ")}`);
	}
	function readNanAmount() {
		return Effect.andThen(
			sql`update ${sql(tables.payments)} set amount = 'NaN'::numeric, note = 'rejected'`,
			payments.findMany({ select: ["amount"] }),
		);
	}
	return {
		countPayments: (where?: Filter) => payments.count(where === undefined ? undefined : { where }),
		countPaymentsWithEmptyQuery: () => payments.count({}),
		decodeNanAmountInTransaction: () =>
			Effect.suspend(() => {
				tell("a transaction sets the stored amount to numeric NaN and the note to rejected by raw SQL, then reads the payments");
				return Effect.map(endingOf(transact(readNanAmount(), { onSqlError: (error) => error })), recorded);
			}),
		endings: () => Effect.sync(() => [...endings]),
		insertPayment: (changes: Partial<PaymentInput> = {}) =>
			Effect.suspend(() => {
				tell(`a payment of ${BigDecimal.format(changes.amount ?? payment.amount)} with note ${String(changes.note ?? payment.note)} is inserted`);
				return Effect.asVoid(payments.insert({ ...payment, ...changes }));
			}),
		insertPayments: (count: number, changes: Partial<PaymentInput> = {}) =>
			Effect.suspend(() => {
				tell(
					`insertMany writes ${count} payments of ${BigDecimal.format(changes.amount ?? payment.amount)} with note ${String(changes.note ?? payment.note)}`,
				);
				return Effect.asVoid(payments.insertMany(Array.from({ length: count }, () => ({ ...payment, ...changes }))));
			}),
		insertReceipt: (details: { readonly attempts: number; readonly channel: string }) =>
			Effect.suspend(() => {
				tell(`a receipt with the plain object ${JSON.stringify(details)} as its JSON column is inserted`);
				return Effect.map(endingOf(receipts.insert({ details })), recorded);
			}),
		insertSample: (id: number, values: Values) =>
			Effect.suspend(() => {
				samplesWritten("insert", [{ id, values }]);
				return Effect.asVoid(samples.insert({ id, values }));
			}),
		insertSamples: (rows: ReadonlyArray<{ readonly id: number; readonly values: Values }>) =>
			Effect.suspend(() => {
				samplesWritten("insertMany", rows);
				return Effect.map(samples.insertMany(rows), (inserted) => returning(sampleRows(inserted)));
			}),
		insertSamplesOrIgnore: (rows: ReadonlyArray<{ readonly id: number; readonly values: Values }>) =>
			Effect.suspend(() => {
				samplesWritten("insertManyOrIgnore", rows);
				return Effect.map(samples.insertManyOrIgnore(rows), (inserted) => returning(sampleRows(inserted)));
			}),
		payment: () => Effect.map(payments.findById(1), printed),
		paymentsMatching: (where: Filter) => Effect.map(payments.findMany({ select: ["amount", "sequence"], where }), (rows) => rows.map(printed)),
		preciseStoredSettledAt: () =>
			Effect.map(
				sql<{
					readonly precise: string;
				}>`select to_char(settled_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') as precise from ${sql(tables.payments)}`,
				(rows) => rows.map(({ precise }) => precise),
			),
		receiptCount: () =>
			Effect.map(sql<{ readonly count: number }>`select count(*)::int as count from ${sql(tables.receipts)}`, ([row]) => row?.count),
		returned: () => Effect.sync(() => returned.at(-1)),
		rewriteTimesWithMicroseconds: () =>
			Effect.suspend(() => {
				tell("raw SQL sets settled_at to 12:11:12.345678+02 and local_time to 10:11:12.345678");
				return Effect.asVoid(
					sql`update ${sql(tables.payments)} set settled_at = '2026-09-19 12:11:12.345678+02'::timestamptz,
						local_time = '2026-09-19 10:11:12.345678'::timestamp`,
				);
			}),
		sample: (id: number) => Effect.map(attempt(samples.findById(id)), (row) => (typeof row === "string" ? row : { id: row.id, values: row.values })),
		samplesWithValues: (values: Values) => Effect.map(samples.findMany({ where: { values } }), sampleRows),
		storedArray: (id: number) =>
			Effect.map(
				sql<{
					readonly missing: boolean;
					readonly size: number;
					readonly type: string;
				}>`select pg_typeof(values)::text as type, values is null as missing, cardinality(values)::int as size from ${sql(tables.samples)} where id = ${id}`,
				([row]) => row,
			),
		storedPayment: () =>
			Effect.map(
				sql<{
					readonly amount: string;
					readonly dueOn: string;
					readonly localTime: string;
					readonly sequence: string;
				}>`select amount::text as amount, sequence::text as sequence, due_on::text as "dueOn", local_time::text as "localTime" from ${sql(tables.payments)}`,
				([row]) => row,
			),
		updatePayment: (changes: Partial<PaymentInput>) =>
			Effect.gen(function* () {
				tell(`the payment is updated with ${JSON.stringify(changes, (_, value) => (typeof value === "bigint" ? `${value}n` : value))}`);
				const current = yield* payments.findById(1);
				yield* payments.update({ ...current, ...changes });
			}),
		updateSample: (id: number, values: Values) =>
			Effect.suspend(() => {
				samplesWritten("update", [{ id, values }]);
				return Effect.asVoid(samples.update({ id, values }));
			}),
		updateSampleVoid: (id: number, values: Values) =>
			Effect.suspend(() => {
				samplesWritten("updateVoid", [{ id, values }]);
				return samples.updateVoid({ id, values });
			}),
		upsertSampleValues: (rows: ReadonlyArray<{ readonly id: number; readonly values: Values }>) =>
			Effect.suspend(() => {
				samplesWritten("upsertMany of the values column", rows);
				return Effect.map(samples.upsertMany(rows, { updateColumns: ["values"] }), (results) =>
					returning(results.map(({ inserted, row }) => ({ inserted, row: { id: row.id, values: row.values } }))),
				);
			}),
	};
}

export const codecs = storyKit({
	...onPostgres,
	create: codecEngine,
	name: "PostgreSQL codecs",
	stages: ["process", "rows"],
	verbs: (engine, story) => codecVerbs(engine, story.tell),
});

export function inTimezone(zone: string) {
	return codecs.trait("process", `the Node process runs in the ${zone} time zone`, function* () {
		vi.stubEnv("TZ", zone);
		yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllEnvs()));
	});
}

export function paymentExists() {
	return codecs.trait(
		"rows",
		`a payment of ${BigDecimal.format(payment.amount)} with sequence ${payment.sequence} and no note exists`,
		({ payments }) => Effect.asVoid(payments.insert(payment)),
	);
}

export function samplesExist(rows: ReadonlyArray<{ readonly id: number; readonly values: Values }>) {
	return codecs.trait("rows", `${rows.map(({ id, values }) => `sample ${id} with [${values.join(", ")}]`).join(" and ")} exist`, ({ samples }) =>
		Effect.asVoid(samples.insertMany(rows)),
	);
}
