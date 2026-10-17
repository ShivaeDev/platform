import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer, Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { connectionLimitHint } from "./connectionLimitHint.ts";

export function connection(url: Redacted.Redacted<string>, maxConnections: number) {
	return Layer.effectContext(
		Effect.map(PgClient.make({ maxConnections, url }), (client) =>
			Context.make(SqlClient.SqlClient, client).pipe(Context.add(PgClient.PgClient, client)),
		),
	).pipe(Layer.provideMerge(Layer.fresh(Reactivity.layer)));
}

const administer = Effect.fn("PostgresTest.administer")(function* (
	url: Redacted.Redacted<string>,
	operation: (admin: PgClient.PgClient) => Effect.Effect<unknown, SqlError>,
) {
	return yield* Effect.scoped(Effect.flatMap(PgClient.makeClient({ url }), operation).pipe(Effect.mapError(connectionLimitHint))).pipe(
		Effect.provide(Reactivity.layer),
	);
});

export const database = Effect.fn("PostgresTest.database")(function* (url: Redacted.Redacted<string>, template = "template0") {
	const name = `effect_test_${crypto.randomUUID().replaceAll("-", "")}`;
	const target = new URL(Redacted.value(url));
	target.pathname = `/${name}`;
	target.searchParams.delete("database");
	yield* Effect.acquireRelease(
		administer(url, (admin) => admin`create database ${admin(name)} template ${admin(template)}`),
		() => Effect.orDie(administer(url, (admin) => admin`drop database ${admin(name)} with (force)`)),
	);
	return { name, url: Redacted.make(target.toString()) };
});
