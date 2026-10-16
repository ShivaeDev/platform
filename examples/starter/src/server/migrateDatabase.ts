import { Config, Effect, Layer, Redacted } from "effect";
import { appDatabase } from "@shivaedev/platform/appHost.ts";
import { authDatabase } from "./authDatabase.ts";
import { migrations } from "./migrations.ts";
import { noteProducer } from "./noteProducer.ts";

export const migrateDatabase = Effect.fn("Starter.migrateDatabase")(function* (databaseUrl?: Redacted.Redacted<string>) {
	const url = databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
	const pool = yield* authDatabase(url);
	yield* Layer.build(appDatabase({ config: { databaseUrl: url }, migrations: migrations(pool) }));
	yield* Layer.build(noteProducer(Redacted.value(url), true));
	yield* Effect.logInfo("Migrations applied");
});
