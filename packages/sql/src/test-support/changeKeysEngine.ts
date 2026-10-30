import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { bucketRows } from "./bucketRows.ts";
import type { compositeLedger } from "./compositeLedger.ts";
import type { setupOwnedRows } from "./postgresOwnedRows.ts";

export interface ChangeKeysEngine {
	readonly buckets: Effect.Success<typeof bucketRows>;
	readonly endings: string[];
	ledger: Effect.Success<typeof compositeLedger> | undefined;
	observing: boolean;
	owned: Effect.Success<typeof setupOwnedRows> | undefined;
	readonly published: Set<string>;
	readonly reactivity: Reactivity.Reactivity;
	readonly sql: SqlClient.SqlClient;
	readonly woken: string[];
}

export const changeKeysEngine = Effect.fnUntraced(function* () {
	const engine: ChangeKeysEngine = {
		buckets: yield* bucketRows,
		endings: [],
		ledger: undefined,
		observing: false,
		owned: undefined,
		published: new Set(),
		reactivity: yield* Reactivity.Reactivity,
		sql: yield* SqlClient.SqlClient,
		woken: [],
	};
	return engine;
});

function tablesOf(engine: ChangeKeysEngine) {
	return [engine.buckets.tableName, engine.owned?.tableName, engine.ledger?.tableName].filter((table) => table !== undefined);
}

function bucketWords(key: string, tables: readonly string[]) {
	try {
		const parsed: unknown = JSON.parse(key);
		if (Array.isArray(parsed) && parsed[0] === "bucket" && tables.includes(String(parsed[1]))) {
			return `${String(parsed[2])} ${JSON.stringify(parsed[3])}`;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

export function keyWords(engine: ChangeKeysEngine, key: string): string {
	const tables = tablesOf(engine);
	if (tables.includes(key)) {
		return "the table";
	}
	const table = tables.find((name) => key.startsWith(`${name}:`));
	if (table !== undefined) {
		return `record ${key.slice(table.length + 1)}`;
	}
	return bucketWords(key, tables) ?? key;
}

export function tableWords(engine: ChangeKeysEngine, table: string): string {
	if (table === engine.buckets.tableName) {
		return "the buckets table";
	}
	return table === engine.owned?.tableName ? "the owned rows table" : table;
}
