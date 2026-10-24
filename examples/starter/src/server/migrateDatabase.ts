import { Config, Effect, Layer, type Redacted } from "effect";
import { installPgBossSchema } from "@shivaedev/effect-pg-boss/server/schema.ts";
import { clientOptions } from "@shivaedev/effect-sql/clientOptions.ts";
import { appDatabase } from "@shivaedev/platform/server/appHost.ts";
import { authDatabase } from "@shivaedev/platform/server/better-auth/mount.ts";
import { migrations } from "#server/migrations.ts";

export const migrateDatabase = Effect.fn("App.migrateDatabase")(function* (databaseUrl?: Redacted.Redacted<string>) {
	const url = databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
	const pool = yield* authDatabase(url);
	const context = yield* Layer.build(appDatabase({ config: clientOptions({ databaseUrl: url }), migrations: migrations(pool) }));
	yield* installPgBossSchema().pipe(Effect.provideContext(context));
	yield* Effect.logInfo("Migrations applied");
});
