import { Config, Effect, Layer, type Redacted } from "effect";
import type { PgBossClientFactory } from "@shivaedev/effect-pg-boss/server/client.ts";
import { appDatabase } from "@shivaedev/platform/server/appHost.ts";
import { authDatabase } from "@shivaedev/platform/server/better-auth/mount.ts";
import { otlpTracing } from "@shivaedev/platform/server/otlpTracing.ts";
import { databaseOptions } from "#server/databaseOptions.ts";
import { workerModules } from "./workerModules.ts";

export function applicationWorker(config?: { readonly databaseUrl?: Redacted.Redacted<string>; readonly clientFactory?: PgBossClientFactory }) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const pool = yield* authDatabase(databaseUrl);
			yield* Effect.logInfo("Worker waiting for schema");
			return workerModules(databaseUrl, config?.clientFactory).pipe(
				Layer.tap(() => Effect.logInfo("Worker ready to take jobs")),
				Layer.provideMerge(appDatabase(databaseOptions(pool, databaseUrl, "wait")).pipe(Layer.tap(() => Effect.logInfo("Worker schema current")))),
			);
		}),
	).pipe(Layer.provide(otlpTracing));
}
