import { Config, Effect, Layer, Option, type Redacted } from "effect";
import { otlpTracing } from "@shivaedev/server/otlpTracing.ts";
import { workerHost } from "@shivaedev/server/workerHost.ts";
import { databaseOptions } from "#server/databaseOptions.ts";
import { emailMailerLayer } from "./emailMailerLayer.ts";
import { JobsClientFactory } from "./JobsClientFactory.ts";
import { jobsLayer } from "./jobsLayer.ts";
import { serverModules } from "./modules.ts";
import type { PoolSizes } from "./PoolSizes.ts";

export function applicationWorker<R = never, E = never, TRequirements = never>(config?: {
	readonly poolSizes?: PoolSizes;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly replacements?: Layer.Layer<R, E, TRequirements>;
}) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const databaseUrl = config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const configuredRelease = yield* Config.option(Config.String("RAILWAY_GIT_COMMIT_SHA"));
			const replacements = config?.replacements ?? Layer.empty;
			const modules = yield* serverModules(replacements);
			const database = databaseOptions(databaseUrl, modules.migrations, "wait", config?.poolSizes?.sql);
			const jobs = jobsLayer(databaseUrl, config?.poolSizes?.jobs).pipe(Layer.provideMerge(Layer.merge(JobsClientFactory.layer, replacements)));
			const services = modules.services.pipe(Layer.provideMerge(jobs));
			return workerHost({
				...modules,
				...database,
				migrations: { ...database.migrations, ...Option.match(configuredRelease, { onNone: () => ({}), onSome: (release) => ({ release }) }) },
				services,
				workers: modules.workers.pipe(Layer.provide(Layer.merge(emailMailerLayer(), replacements))),
			}).pipe(Layer.tap(() => Effect.logInfo("Worker ready to take jobs")));
		}),
	).pipe(Layer.provide(otlpTracing));
}
