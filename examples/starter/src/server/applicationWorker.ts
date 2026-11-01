import { Config, Effect, Layer, Option, type Redacted } from "effect";
import { appDatabase } from "@shivaedev/server/appDatabase.ts";
import { otlpTracing } from "@shivaedev/server/otlpTracing.ts";
import { databaseOptions } from "#server/databaseOptions.ts";
import { emailMailerLayer } from "./emailMailerLayer.ts";
import { JobsClientFactory } from "./JobsClientFactory.ts";
import { jobsLayer } from "./jobsLayer.ts";
import type { PoolSizes } from "./PoolSizes.ts";
import { workerModules } from "./workerModules.ts";

export function applicationWorker<R = never, E = never, TRequirements = never>(config?: {
	readonly poolSizes?: PoolSizes;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly replacements?: Layer.Layer<R, E, TRequirements>;
}) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const configuredRelease = yield* Config.option(Config.String("RAILWAY_GIT_COMMIT_SHA"));
			const database = databaseOptions(databaseUrl, "wait", config?.poolSizes?.sql);
			return workerModules.pipe(
				Layer.provide(Layer.merge(emailMailerLayer(), config?.replacements ?? Layer.empty)),
				Layer.provide(jobsLayer(databaseUrl, config?.poolSizes?.jobs)),
				Layer.provideMerge(Layer.merge(JobsClientFactory.layer, config?.replacements ?? Layer.empty)),
				Layer.merge(config?.replacements ?? Layer.empty),
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
