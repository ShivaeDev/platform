import { Effect, Layer } from "effect";
import { type AppDatabaseOptions, appDatabase, type DatabaseConfig } from "#appDatabase.ts";
import { hostCrypto } from "#hostCrypto.ts";
import { redactedHost } from "#redactedHost.ts";

export interface WorkerHostConfig extends DatabaseConfig {
	readonly sensitiveKeys?: readonly string[];
}

export function workerHost<R, E, TRequirements, TServices, TServiceError, TServiceRequirements, TMigrations = never, TMigrationError = never>(
	options: AppDatabaseOptions<TMigrations, TMigrationError> & {
		readonly config?: WorkerHostConfig;
		readonly workers: Layer.Layer<R, E, TRequirements>;
		readonly services: Layer.Layer<TServices, TServiceError, TServiceRequirements>;
	},
) {
	// A worker serves no RPC group, so its policy holds the built-in rules, config.sensitiveKeys and the models its repositories declare as they are built.
	// The host announces readiness itself: an effect composed around the returned Layer runs outside its policy and exporter.
	return redactedHost(options, () =>
		Layer.effectDiscard(Effect.logInfo("Worker ready to take jobs")).pipe(
			Layer.provideMerge(options.workers),
			Layer.provideMerge(options.services),
			Layer.provideMerge(appDatabase(options)),
		),
	).pipe(Layer.provide(hostCrypto));
}
