import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
import type { crossTableReads } from "#test/cross-table/reads.ts";
import { CopiedRow, InvoiceLine, LatestRun, LedgerEntry, PartialRow, Payment, Sample, SourceRow, TestResult, UtcPayment } from "./queryModels.ts";

export type Compiled = readonly [string, readonly unknown[]];

export const TABLES = ["copies", "ledger", "lines", "partialRows", "payments", "results", "runs", "samples", "sources"] as const;

export type Table = (typeof TABLES)[number];

function tableNames(): Readonly<Record<Table, string>> {
	const suffix = crypto.randomUUID().replaceAll("-", "");
	return {
		copies: `query_copies_${suffix}`,
		ledger: `query_ledger_${suffix}`,
		lines: `query_lines_${suffix}`,
		partialRows: `query_partial_rows_${suffix}`,
		payments: `query_payments_${suffix}`,
		results: `query_results_${suffix}`,
		runs: `query_runs_${suffix}`,
		samples: `query_samples_${suffix}`,
		sources: `query_sources_${suffix}`,
	};
}

export const queryEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tables = tableNames();
	yield* Effect.addFinalizer(() => Effect.orDie(sql.unsafe(`drop table if exists ${TABLES.map((table) => `"${tables[table]}"`).join(", ")}`)));
	yield* sql`create table ${sql(tables.samples)} (id integer primary key, values int4[] not null)`;
	yield* sql`create table ${sql(tables.payments)} (
		id integer generated always as identity primary key, amount numeric(36, 12) not null, sequence int8 not null,
		due_on date not null, settled_at timestamptz not null, note text
	)`;
	yield* sql`create table ${sql(tables.lines)} (id integer generated always as identity primary key, name text not null, amount text not null, note text)`;
	yield* sql`create table ${sql(tables.sources)} ("sourceKey" integer primary key, "displayName" text not null, amount text not null, status text not null)`;
	yield* sql`create table ${sql(tables.copies)} (
		id integer generated always as identity primary key, "copiedKey" integer not null unique, name text not null, amount text not null,
		"createdAt" timestamptz not null default now()
	)`;
	yield* sql`create table ${sql(tables.partialRows)} (
		id integer generated always as identity primary key, a text not null, b text not null, kind text not null, value integer not null
	)`;
	yield* sql`create table ${sql(tables.ledger)} (account text not null, sequence bigint not null, amount text not null, primary key (account, sequence))`;
	yield* sql`create table ${sql(tables.results)} (
		id integer primary key, file text not null, project text not null, "durationMs" integer not null, failed boolean, weight numeric
	)`;
	yield* sql`create table ${sql(tables.runs)} (id integer primary key, repository numeric not null, workflow text, status text not null)`;
	const announced: string[] = [];
	const statements: Compiled[] = [];
	const dashboard: { reads?: Effect.Success<typeof crossTableReads> } = {};
	const last: { result?: unknown } = {};
	const endings: string[] = [];
	return {
		announced,
		copies: yield* makeRepository(CopiedRow, { conflictColumns: ["copiedKey"], idColumn: "id", spanPrefix: "CopiedRow", tableName: tables.copies }),
		dashboard,
		endings,
		last,
		ledger: yield* makeRepository(LedgerEntry, { idColumn: ["account", "sequence"], spanPrefix: "LedgerEntry", tableName: tables.ledger }),
		lines: yield* makeRepository(InvoiceLine, { idColumn: "id", spanPrefix: "InvoiceLine", tableName: tables.lines }),
		partialRows: yield* makeRepository(PartialRow, { idColumn: "id", spanPrefix: "PartialRow", tableName: tables.partialRows }),
		payments: yield* makeRepository(Payment, { idColumn: "id", spanPrefix: "Payment", tableName: tables.payments }),
		reactivity: yield* Reactivity.Reactivity,
		results: yield* makeRepository(TestResult, { idColumn: "id", spanPrefix: "TestResult", tableName: tables.results }),
		runs: yield* makeRepository(LatestRun, { idColumn: "id", spanPrefix: "LatestRun", tableName: tables.runs }),
		samples: yield* makeRepository(Sample, { conflictColumns: ["id"], idColumn: "id", spanPrefix: "Sample", tableName: tables.samples }),
		sources: yield* makeRepository(SourceRow, { idColumn: "sourceKey", spanPrefix: "SourceRow", tableName: tables.sources }),
		sql,
		statements,
		tables,
		utcPayments: yield* makeRepository(UtcPayment, { idColumn: "id", spanPrefix: "UtcPayment", tableName: tables.payments }),
	};
});

export type QueryEngine = Effect.Success<ReturnType<typeof queryEngine>>;
