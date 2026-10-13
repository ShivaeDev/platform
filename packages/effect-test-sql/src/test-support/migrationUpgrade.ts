import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { Migrator, SqlClient } from "effect/sql";
import { makePostgresTestLayer } from "#postgres.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { adminUrl } from "./postgres.ts";

export class Item extends Model.Class<Item>("Item")({
	id: Model.GeneratedByDb(Schema.Number),
	name: Schema.String,
	price: Schema.NullOr(Schema.Number),
	publicLabel: Model.FieldOnly(["json"])(Schema.String),
}) {}

export const types = { id: "integer", name: "text", price: "numeric(10,2)" };

export const migrations = {
	loader: Migrator.fromRecord({
		"1_create_items": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table items (id serial primary key, old_name text not null, removed boolean)`;
			yield* sql`insert into items (old_name) values ('kept')`;
		}),
		"3_upgrade_items": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`alter table items rename column old_name to name`;
			yield* sql`alter table items drop column removed`;
			yield* sql`alter table items add column price numeric(10,2)`;
		}),
	}),
	lockTimeout: "5 seconds" as const,
	table: "upgrade_migrations",
};

const layer = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: adminUrl,
});

export function runUpgrade<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return withIsolatedDatabase(effect).pipe(Effect.provide(layer));
}
