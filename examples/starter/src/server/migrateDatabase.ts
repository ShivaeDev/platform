import { Config, Effect, Layer, Option, type Redacted } from "effect";
import { appDatabase } from "@shivaedev/server/appDatabase.ts";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { migrations } from "#server/migrations.ts";

export const migrateDatabase = Effect.fn("App.migrateDatabase")(function* (databaseUrl?: Redacted.Redacted<string>) {
	const url = databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
	const configuredRelease = yield* Config.option(Config.String("RAILWAY_GIT_COMMIT_SHA"));
	yield* Layer.build(
		appDatabase({
			config: clientOptions({ databaseUrl: url }),
			migrations: { ...migrations(), ...Option.match(configuredRelease, { onNone: () => ({}), onSome: (release) => ({ release }) }) },
		}),
	);
	yield* Effect.logInfo("Migrations applied");
});
