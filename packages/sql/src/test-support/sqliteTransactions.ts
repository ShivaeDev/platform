import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Context, Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
export const setup = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reactivity = yield* Reactivity.Reactivity;
	yield* sql`pragma foreign_keys = on`;
	yield* sql`create table orders (id integer primary key, name text not null)`;
	yield* sql`create table notes (id integer primary key, order_id integer references orders (id) deferrable initially deferred)`;
	const events: string[] = [];
	for (const key of ["orders", "orders:1", "orders:2"]) {
		reactivity.registerUnsafe([key], () => events.push(key));
	}
	function insert(id: number) {
		return sql`insert into orders (id, name) values (${id}, ${`order ${id}`})`;
	}
	const count = Effect.map(sql<{ readonly total: number }>`select count(*) as total from orders`, ([row]) => row?.total);
	return { count, events, insert, sql };
});
export const secondDatabase = Effect.gen(function* () {
	const main = yield* SqlClient.SqlClient;
	const other = Context.get(yield* Layer.build(Layer.fresh(SqliteClient.layer({ filename: ":memory:" }))), SqlClient.SqlClient);
	yield* other`create table orders (id integer primary key)`;
	const otherIds = Effect.map(other<{ readonly id: number }>`select id from orders`, (rows) => rows.map((row) => row.id));
	return { onMain: Effect.provideService(SqlClient.SqlClient, main), onOther: Effect.provideService(SqlClient.SqlClient, other), other, otherIds };
});
