import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { type OrderServerOptions, orderWebHandler } from "./runtime.ts";
import { makeOrdersRepository, OrderService, OrdersRepository } from "./service.ts";

const seeded = Layer.effect(
	OrdersRepository,
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table orders (id integer primary key, ownerId text not null, name text not null, quantity integer not null)`;
		yield* sql`insert into orders (id, ownerId, name, quantity) values (1, 'alice', 'Printer paper', 300), (2, 'bob', 'Desk lamps', 200), (3, 'alice', 'Toner', 150)`;
		return yield* makeOrdersRepository;
	}),
);

export function makeWebHandler(options: OrderServerOptions = {}) {
	const database = Layer.merge(SqliteClient.layer({ filename: ":memory:" }), Reactivity.layer);
	return orderWebHandler(OrderService.layer.pipe(Layer.provide(seeded), Layer.provide(database)), options);
}
