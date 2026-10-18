import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer, Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { SqlNameTransforms } from "@shivaedev/effect-sql/clientOptions.ts";
import { connectionLimitHint } from "./connectionLimitHint.ts";
import { databaseName } from "./databaseOwner.ts";

export function connection(url: Redacted.Redacted<string>, maxConnections: number, transforms: SqlNameTransforms) {
	return Layer.effectContext(
		Effect.map(
			PgClient.make({
				maxConnections,
				transformQueryNames: transforms.transformQueryNames,
				transformResultNames: transforms.transformResultNames,
				url,
			}),
			(client) => Context.make(SqlClient.SqlClient, client).pipe(Context.add(PgClient.PgClient, client)),
		),
	).pipe(Layer.provideMerge(Layer.fresh(Reactivity.layer)));
}

export const administer = Effect.fn("PostgresTest.administer")(function* <A>(
	url: Redacted.Redacted<string>,
	operation: (admin: PgClient.PgClient) => Effect.Effect<A, SqlError>,
) {
	return yield* Effect.scoped(Effect.flatMap(PgClient.makeClient({ url }), operation).pipe(Effect.mapError(connectionLimitHint))).pipe(
		Effect.provide(Reactivity.layer),
	);
});

export const database = Effect.fn("PostgresTest.database")(function* (
	url: Redacted.Redacted<string>,
	release: (name: string) => Effect.Effect<unknown>,
	template = "template0",
) {
	const name = databaseName();
	const target = new URL(Redacted.value(url));
	target.pathname = `/${name}`;
	target.searchParams.delete("database");
	yield* Effect.acquireRelease(
		administer(url, (admin) => admin`create database ${admin(name)} template ${admin(template)}`),
		() => release(name),
	);
	return { name, url: Redacted.make(target.toString()) };
});
