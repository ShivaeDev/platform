import { Context, Effect, Layer, Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
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

export function repositoryLayer(table: string, ledger: string) {
	return Layer.effect(
		OrdersRepository,
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const loader = Migrator.fromRecord({
				"001_orders": Effect.gen(function* () {
					yield* sql`create table ${sql(table)} (id integer primary key, "ownerId" text not null, name text not null, quantity integer not null)`;
					yield* sql`insert into ${sql(table)} (id, "ownerId", name, quantity) values (1, 'alice', 'Printer paper', 300)`;
				}),
			});
			yield* migratePostgres({ loader, lockTimeout: "5 seconds", table: ledger });
			return yield* repository(table);
		}),
	);
}
