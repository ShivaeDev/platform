import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Context, Data, Effect, type Fiber, Layer, type Queue } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { sqlReasonOf } from "./outcome.ts";
import { postgresLayer } from "./postgres.ts";
import { RecordedLogs } from "./RecordedLogs.ts";

export class Rejected extends Data.TaggedError("Rejected")<{ readonly message: string }> {}
export class Unavailable extends Data.TaggedError("Unavailable")<{ readonly message: string }> {}

export function onSqlError(error: SqlError) {
	return new Unavailable({ message: `storage unavailable after ${sqlReasonOf(error)}` });
}

export type Database = "PostgreSQL" | "SQLite";

export interface TransactionEngine {
	readonly announced: string[];
	committing: { readonly fiber: Fiber.Fiber<unknown, unknown> } | undefined;
	readonly database: Database;
	readonly endings: string[];
	liveOrders: Queue.Dequeue<ReadonlyArray<number | bigint>> | undefined;
	readonly logs: RecordedLogs["Service"];
	readonly main: SqlClient.SqlClient;
	readonly other: SqlClient.SqlClient;
	readonly reactivity: Reactivity.Reactivity;
	straggler: { readonly fiber: Fiber.Fiber<unknown, unknown>; readonly release: Effect.Effect<boolean> } | undefined;
	readonly tables: { readonly notes: string; readonly orders: string; readonly others: string };
}

function otherClient(database: Database) {
	return database === "PostgreSQL" ? Layer.fresh(postgresLayer) : Layer.fresh(SqliteClient.layer({ filename: ":memory:" }));
}

function tableNames(database: Database) {
	const suffix = database === "PostgreSQL" ? `_${crypto.randomUUID().replaceAll("-", "")}` : "";
	return { notes: `transact_notes${suffix}`, orders: `transact_orders${suffix}`, others: `transact_others${suffix}` };
}

export function transactionEngine(database: Database) {
	return Effect.fnUntraced(function* () {
		const main = yield* SqlClient.SqlClient;
		const other = Context.get(yield* Layer.build(otherClient(database)), SqlClient.SqlClient);
		const tables = tableNames(database);
		if (database === "SQLite") {
			yield* main`pragma foreign_keys = on`;
		}
		yield* main`create table ${main(tables.orders)} (id integer primary key, name text not null)`;
		yield* main`create table ${main(tables.notes)} (id integer primary key, order_id integer references ${main(tables.orders)} (id) deferrable initially deferred)`;
		yield* other`create table ${other(tables.others)} (id integer primary key)`;
		if (database === "PostgreSQL") {
			yield* Effect.addFinalizer(() =>
				Effect.orDie(Effect.andThen(main`drop table ${main(tables.notes)}, ${main(tables.orders)}`, other`drop table ${other(tables.others)}`)),
			);
		}
		const engine: TransactionEngine = {
			announced: [],
			committing: undefined,
			database,
			endings: [],
			liveOrders: undefined,
			logs: yield* RecordedLogs,
			main,
			other,
			reactivity: yield* Reactivity.Reactivity,
			straggler: undefined,
			tables,
		};
		return engine;
	});
}
