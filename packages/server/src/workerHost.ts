import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Layer } from "effect";
import { type AppDatabaseOptions, appDatabase } from "#appDatabase.ts";

export function workerHost<R, E, TRequirements, TServices, TServiceError, TServiceRequirements, TMigrations = never, TMigrationError = never>(
	options: AppDatabaseOptions<TMigrations, TMigrationError> & {
		readonly workers: Layer.Layer<R, E, TRequirements>;
		readonly services: Layer.Layer<TServices, TServiceError, TServiceRequirements>;
	},
) {
	return options.workers.pipe(Layer.provideMerge(options.services), Layer.provideMerge(appDatabase(options)), Layer.provide(NodeCrypto.layer));
}
