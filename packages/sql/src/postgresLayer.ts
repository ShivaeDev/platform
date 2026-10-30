import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgPool from "@effect/sql-pg/PgPool";
import { Context, Effect, Layer, type Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { makePostgresClient } from "#adapters/makePostgresClient.ts";
import { postgresStream } from "#adapters/postgresStream.ts";
import type { SqlNameTransforms } from "#clientOptions.ts";
import { databaseAddress } from "#databaseAddress.ts";

export interface PostgresOptions extends SqlNameTransforms {
	readonly applicationName?: string | undefined;
	readonly maxConnections?: number | undefined;
}

export function postgresLayer(url: Redacted.Redacted<string>, options?: PostgresOptions) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const address = databaseAddress(url);
			const stream = yield* postgresStream(url, address);
			const config = { ...options, ...address, stream, url };
			const pool = yield* PgPool.make(config);
			const client = yield* makePostgresClient(config).pipe(Effect.provideService(PgPool.PgPool, pool));
			return Context.make(PgPool.PgPool, pool).pipe(Context.add(PgClient.PgClient, client), Context.add(SqlClient.SqlClient, client));
		}),
	).pipe(Layer.provide(Reactivity.layer));
}
