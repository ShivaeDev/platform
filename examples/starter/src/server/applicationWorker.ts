import { Config, Effect, Layer, Option, type Redacted } from "effect";
import { authDatabase } from "@shivaedev/identity/server/better-auth/mount.ts";
import type { PgBossClientFactory } from "@shivaedev/jobs/server/client.ts";
import { appDatabase } from "@shivaedev/server/appHost.ts";
import { otlpTracing } from "@shivaedev/server/otlpTracing.ts";
import { databaseOptions } from "#server/databaseOptions.ts";
import type { PoolSizes } from "./PoolSizes.ts";
import { workerModules } from "./workerModules.ts";

export function applicationWorker(config?: {
	readonly poolSizes?: PoolSizes;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly clientFactory?: PgBossClientFactory;
}) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const pool = yield* authDatabase(databaseUrl, { max: config?.poolSizes?.auth });
			const configuredRelease = yield* Config.option(Config.String("RAILWAY_GIT_COMMIT_SHA"));
			const database = databaseOptions(pool, databaseUrl, "wait", config?.poolSizes?.sql);
			return workerModules(databaseUrl, config?.clientFactory, config?.poolSizes?.jobs).pipe(
				Layer.tap(() => Effect.logInfo("Worker ready to take jobs")),
				Layer.provideMerge(
					appDatabase({
						...database,
						migrations: { ...database.migrations, ...Option.match(configuredRelease, { onNone: () => ({}), onSome: (release) => ({ release }) }) },
					}),
				),
			);
		}),
	).pipe(Layer.provide(otlpTracing));
}
