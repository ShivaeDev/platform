import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
import type { Table } from "#test/createQueryTables.ts";
import type { crossTableReads } from "#test/cross-table/reads.ts";
import { CopiedRow, InvoiceLine, LatestRun, LedgerEntry, PartialRow, Payment, Sample, SourceRow, TestResult, UtcPayment } from "#test/queryModels.ts";

export type Compiled = readonly [string, readonly unknown[]];

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
