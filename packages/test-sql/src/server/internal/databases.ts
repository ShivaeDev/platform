import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer, Redacted } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import { type PostgresOptions, postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { connectionLimitHint } from "./connectionLimitHint.ts";
import { databaseName } from "./databaseOwner.ts";

export const administer = Effect.fn("PostgresTest.administer")(function* <A>(
	url: Redacted.Redacted<string>,
	operation: (admin: PgClient.PgClient) => Effect.Effect<A, SqlError>,
	options?: PostgresOptions,
) {
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const services = yield* Layer.build(postgresLayer(url, { ...options, transformQueryNames: undefined, transformResultNames: undefined }));
			return yield* operation(Context.get(services, PgClient.PgClient));
		}).pipe(Effect.mapError(connectionLimitHint)),
	);
});

export const database = Effect.fn("PostgresTest.database")(function* (
	url: Redacted.Redacted<string>,
	release: (name: string) => Effect.Effect<unknown>,
	template = "template0",
	options?: PostgresOptions,
) {
	const name = yield* databaseName;
	const target = new URL(Redacted.value(url));
	target.pathname = `/${name}`;
	target.searchParams.delete("database");
	yield* Effect.acquireRelease(
		administer(url, (admin) => admin`create database ${admin(name)} template ${admin(template)}`, options),
		() => release(name),
	);
	return { name, url: Redacted.make(target.toString()) };
});
