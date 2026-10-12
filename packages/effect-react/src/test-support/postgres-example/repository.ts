import { Context, Effect, Layer, Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { Order } from "./contract.ts";

class OrderRow extends Model.Class<OrderRow>("OrderRow")({
	...Order.fields,
	id: Model.Field({ json: Order.fields.id, select: Order.fields.id, update: Order.fields.id }),
	ownerId: Schema.String,
}) {}
function repository(tableName: string) {
	return makeRepository(OrderRow, { idColumn: "id", spanPrefix: "Orders", tableName });
}
export class OrdersRepository extends Context.Service<OrdersRepository, Effect.Success<ReturnType<typeof repository>>>()(
	"postgres-example/Repository",
) {}

export function orderMigrations(table: string) {
	return Migrator.fromRecord({
		"001_orders": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table ${sql(table)} (id integer primary key, "ownerId" text not null, name text not null, quantity integer not null)`;
			yield* sql`insert into ${sql(table)} (id, "ownerId", name, quantity) values (1, 'alice', 'Printer paper', 300)`;
		}),
	});
}

export function repositoryLayer(table: string) {
	return Layer.effect(OrdersRepository, repository(table));
}
