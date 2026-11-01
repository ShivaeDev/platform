import { Effect, type Fiber, Queue, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
import { ownTable, uniqueTable } from "./writeTables.ts";

export class RetainedRow extends Model.Class<RetainedRow>("RetainedRow")({ id: Schema.Int }) {}

export const purgeEngine = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = uniqueTable("purge_rows");
	const audit = uniqueTable("purge_batches");
	const trigger = uniqueTable("purge_audit");
	yield* ownTable(sql, table, sql`id integer primary key`);
	yield* ownTable(sql, audit, sql`ordinal integer generated always as identity, removed integer not null, transaction_id text not null`);
	yield* Effect.acquireRelease(
		sql`create function ${sql(trigger)}() returns trigger language plpgsql as ${sql.literal(`'begin
			insert into ${audit} (removed, transaction_id) select count(*), txid_current()::text from removed;
			return null;
		end'`)}`,
		() => Effect.orDie(sql`drop function if exists ${sql(trigger)}() cascade`),
	);
	yield* sql`create trigger audit_purge after delete on ${sql(table)} referencing old table as removed for each statement execute function ${sql(trigger)}()`;
	const reactivity = yield* Reactivity.Reactivity;
	const refreshed: number[] = [];
	const stop = reactivity.registerUnsafe([table], () => refreshed.push(refreshed.length + 1));
	yield* Effect.addFinalizer(() => Effect.sync(stop));
	const running: {
		fiber: Fiber.Fiber<number, unknown> | undefined;
		locker: Fiber.Fiber<never, unknown> | undefined;
		hints: unknown[][];
	} = { fiber: undefined, hints: [], locker: undefined };
	return {
		...running,
		audit,
		competingRows: yield* makeRepository(RetainedRow, { idColumn: "id", spanPrefix: "CompetingRetention", tableName: table }),
		publications: yield* Queue.unbounded<void>(),
		refreshed,
		rows: yield* makeRepository(RetainedRow, { idColumn: "id", spanPrefix: "Retention", tableName: table }),
		sql,
		table,
	};
});

export type PurgeEngine = Effect.Success<ReturnType<typeof purgeEngine>>;
