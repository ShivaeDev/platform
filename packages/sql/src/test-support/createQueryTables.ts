import { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import { ownTable } from "./writeTables.ts";

export const TABLES = ["copies", "ledger", "lines", "partialRows", "payments", "results", "runs", "samples", "sources"] as const;
export type Table = (typeof TABLES)[number];

export function createQueryTables(sql: SqlClient.SqlClient, tables: Readonly<Record<Table, string>>, selected: readonly Table[]) {
	const columns = {
		copies: sql`
		id integer generated always as identity primary key, "copiedKey" integer not null unique, name text not null, amount text not null,
		"createdAt" timestamptz not null default now()
	`,
		ledger: sql`account text not null, sequence bigint not null, amount text not null, primary key (account, sequence)`,
		lines: sql`id integer generated always as identity primary key, name text not null, amount text not null, note text`,
		partialRows: sql`
		id integer generated always as identity primary key, a text not null, b text not null, kind text not null, value integer not null
	`,
		payments: sql`
		id integer generated always as identity primary key, amount numeric(36, 12) not null, sequence int8 not null,
		due_on date not null, settled_at timestamptz not null, note text
	`,
		results: sql`
		id integer primary key, file text not null, project text not null, "durationMs" integer not null, failed boolean, weight numeric
	`,
		runs: sql`id integer primary key, repository numeric not null, workflow text, status text not null`,
		samples: sql`id integer primary key, values int4[] not null`,
		sources: sql`"sourceKey" integer primary key, "displayName" text not null, amount text not null, status text not null`,
	};
	return Effect.forEach(selected, (table) => ownTable(sql, tables[table], columns[table]), { discard: true });
}
