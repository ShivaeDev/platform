import { PgClient } from "@effect/sql-pg";
import { Config, Effect } from "effect";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { makeAuth } from "./auth.ts";
import { migrations } from "./migrations.ts";

export const migrateDatabase = Effect.gen(function* () {
	const url = yield* Config.Redacted("DATABASE_URL");
	const { auth } = yield* makeAuth({ databaseUrl: url });
	return yield* migratePostgres(migrations(auth)).pipe(Effect.provide(PgClient.layer({ url })));
});
