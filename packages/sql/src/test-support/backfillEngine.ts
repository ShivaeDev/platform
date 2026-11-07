import { Context, Data, Deferred, Effect, type Fiber, Layer } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { migratePostgres } from "#migrations.ts";
import { postgresLayer } from "#test/postgres.ts";

export class ProgressRejected extends Data.TaggedError("ProgressRejected") {}

export interface BackfillRow {
	readonly id: number;
	readonly name: string;
	readonly writes: number;
}

export interface BatchAnnouncement {
	readonly keys: readonly unknown[];
	readonly progress: number;
	readonly rows: readonly BackfillRow[];
}

export interface BackfillEngine {
	readonly announcements: Record<string, BatchAnnouncement[]>;
	competing: Fiber.Fiber<number | string> | undefined;
	failAt: number | undefined;
	holdAt: number | undefined;
	readonly observer: SqlClient.SqlClient;
	readonly paused: Deferred.Deferred<void>;
	running: Fiber.Fiber<number | string> | undefined;
	selectExtra: number;
	readonly sql: SqlClient.SqlClient;
	readonly tables: { readonly items: string; readonly progress: string; readonly ledger: string };
}

export const backfillEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const observer = Context.get(yield* Layer.build(Layer.fresh(postgresLayer)), SqlClient.SqlClient);
	const prefix = `backfill_${crypto.randomUUID().replaceAll("-", "")}`;
	const tables = { items: `${prefix}_items`, ledger: `${prefix}_ledger`, progress: `${prefix}_progress` };
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tables.items)}, ${sql(tables.progress)}, ${sql(tables.ledger)}`.pipe(Effect.orDie));
	yield* migratePostgres({
		loader: Migrator.fromRecord({
			"1_create_items": sql`create table ${sql(tables.items)} (run text not null, id integer not null, name text not null, writes integer not null default 0, primary key (run, id))`,
			"2_create_progress": sql`create table ${sql(tables.progress)} (run text primary key, last_id integer not null)`,
		}),
		lockTimeout: "5 seconds",
		table: tables.ledger,
	});
	const engine: BackfillEngine = {
		announcements: {},
		competing: undefined,
		failAt: undefined,
		holdAt: undefined,
		observer,
		paused: yield* Deferred.make<void>(),
		running: undefined,
		selectExtra: 0,
		sql,
		tables,
	};
	return engine;
});

export function storedBackfillRows({ observer: sql, tables }: BackfillEngine, run: string) {
	return sql<BackfillRow>`select id, name, writes from ${sql(tables.items)} where run = ${run} order by id`;
}

export function storedBackfillProgress({ observer: sql, tables }: BackfillEngine, run: string) {
	return Effect.map(sql<{ readonly id: number }>`select last_id as id from ${sql(tables.progress)} where run = ${run}`, ([row]) => row?.id ?? 0);
}
