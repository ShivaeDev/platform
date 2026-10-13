import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer, Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";

export function connection(url: Redacted.Redacted<string>) {
	return Layer.effectContext(
		Effect.map(PgClient.make({ url }), (client) => Context.make(SqlClient.SqlClient, client).pipe(Context.add(PgClient.PgClient, client))),
	).pipe(Layer.provideMerge(Layer.fresh(Reactivity.layer)));
}

export const database = Effect.fn("PostgresTest.database")(function* (
	admin: PgClient.PgClient,
	url: Redacted.Redacted<string>,
	template = "template0",
) {
	const name = `effect_test_${crypto.randomUUID().replaceAll("-", "")}`;
	const target = new URL(Redacted.value(url));
	target.pathname = `/${name}`;
	target.searchParams.delete("database");
	yield* Effect.acquireRelease(admin`create database ${admin(name)} template ${admin(template)}`, () =>
		Effect.orDie(admin`drop database ${admin(name)} with (force)`),
	);
	return { name, url: Redacted.make(target.toString()) };
});
