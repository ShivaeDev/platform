import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Data, Effect, Layer, Redacted, type Scope } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";
import { test } from "vitest";
import { environmentVariable } from "./environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");

export const integration = databaseUrl === undefined ? test.skip : test;

export class Unavailable extends Data.TaggedError("Unavailable")<{ readonly reason: string }> {}
export class Rejected extends Data.TaggedError("Rejected") {}

export function onSqlError(error: { readonly message: string }) {
	return new Unavailable({ reason: error.message });
}

function pool() {
	return PgClient.layer({ url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled") });
}

export function runPostgres<A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient | Reactivity.Reactivity | Scope.Scope>) {
	return Effect.runPromise(Effect.scoped(effect).pipe(Effect.provide(Layer.merge(pool(), Reactivity.layer))));
}

export const secondPool = Effect.suspend(() => Effect.map(Layer.build(pool()), (context) => Context.get(context, SqlClient.SqlClient)));

function ids(rows: ReadonlyArray<{ readonly id: number }>) {
	return rows.map((row) => row.id);
}

export const setup = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reactivity = yield* Reactivity.Reactivity;
	const suffix = crypto.randomUUID().replaceAll("-", "");
	const tables = {
		notes: `platform_effect_sql_notes_${suffix}`,
		orders: `platform_effect_sql_orders_${suffix}`,
		others: `platform_effect_sql_others_${suffix}`,
	};
	yield* Effect.acquireRelease(
		Effect.all([
			sql`create table ${sql(tables.orders)} (id integer primary key, name text not null)`,
			sql`create table ${sql(tables.notes)} (id integer primary key, order_id integer references ${sql(tables.orders)} (id) deferrable initially deferred)`,
			sql`create table ${sql(tables.others)} (id integer primary key)`,
		]),
		() => Effect.orDie(sql`drop table ${sql(tables.notes)}, ${sql(tables.orders)}, ${sql(tables.others)}`),
	);
	const events: string[] = [];
	for (const key of ["orders", "orders:1", "orders:2"]) {
		reactivity.registerUnsafe([key], () => events.push(key));
	}
	function insert(id: number) {
		return sql`insert into ${sql(tables.orders)} (id, name) values (${id}, ${`order ${id}`})`;
	}
	const count = Effect.map(sql<{ readonly total: number }>`select count(*)::int as total from ${sql(tables.orders)}`, ([row]) => row?.total);
	function orderIds(client: SqlClient.SqlClient) {
		return Effect.map(client<{ readonly id: number }>`select id from ${sql(tables.orders)} order by id`, ids);
	}
	function otherIds(client: SqlClient.SqlClient) {
		return Effect.map(client<{ readonly id: number }>`select id from ${sql(tables.others)} order by id`, ids);
	}
	function insertOther(client: SqlClient.SqlClient, id: number) {
		return client`insert into ${sql(tables.others)} (id) values (${id})`;
	}
	return { count, events, insert, insertOther, orderIds, otherIds, reactivity, sql, tables };
});

export function onClient(client: SqlClient.SqlClient) {
	return Effect.provideService(SqlClient.SqlClient, client);
}
