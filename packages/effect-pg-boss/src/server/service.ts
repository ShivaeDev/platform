import { Context, Effect, Layer, type Option, type Schema } from "effect";
import type { ConstructorOptions, JobWithMetadata, SendOptions, StopOptions } from "pg-boss";
import type { PgBossClientFactory } from "#client.ts";
import type { JobPayloadSchema, JobRegistration, QueueDefinition, RegistrationRequirements } from "#definition.ts";
import type { PgBossError, PgBossPayloadError, PgBossQueueOptionsError } from "#error.ts";
import type { JobsHealth, QueueCounts } from "#health.ts";
import { acquireClient, releaseClient } from "#internal/lifecycle.ts";
import { registerJobs, registrationName } from "#internal/register.ts";
import { makeService } from "#internal/service.ts";

export interface PgBossService {
	readonly counts: (queue: QueueDefinition) => Effect.Effect<QueueCounts, PgBossError>;
	readonly enqueue: <const TName extends string, const TPayload extends JobPayloadSchema>(
		queue: QueueDefinition<TName, TPayload>,
		payload: Schema.Schema.Type<TPayload>,
		options?: SendOptions,
	) => Effect.Effect<Option.Option<string>, PgBossError | PgBossPayloadError, TPayload["EncodingServices"]>;
	readonly getJob: <const TName extends string, const TPayload extends JobPayloadSchema>(
		queue: QueueDefinition<TName, TPayload>,
		id: string,
	) => Effect.Effect<Option.Option<JobWithMetadata<TPayload["Type"]>>, PgBossError | PgBossPayloadError, TPayload["DecodingServices"]>;
	readonly health: Effect.Effect<JobsHealth, PgBossError>;
	readonly retry: (queue: QueueDefinition, id: string) => Effect.Effect<void, PgBossError>;
}

export type PgBossLayerOptions<TRegistrations extends readonly JobRegistration[], TErrorRequirements> = ConstructorOptions & {
	readonly clientFactory?: PgBossClientFactory;
	// One started client is reference-counted per key, so development module reloads reuse it instead of starting another.
	readonly clientCacheKey?: string | symbol | undefined;
	readonly jobs: TRegistrations;
	readonly onError?: (error: Error) => Effect.Effect<unknown, never, TErrorRequirements>;
	readonly stop?: StopOptions;
};

export interface PgBossDefinition<TIdentifier extends string = string> extends Context.Service<TIdentifier, PgBossService> {
	readonly layer: <const TRegistrations extends readonly JobRegistration[], TErrorRequirements = never>(
		options: PgBossLayerOptions<TRegistrations, TErrorRequirements>,
	) => Layer.Layer<TIdentifier, PgBossError | PgBossQueueOptionsError, RegistrationRequirements<TRegistrations> | TErrorRequirements>;
}

function logClientError(error: Error): Effect.Effect<void> {
	return Effect.logError({ event: "pg_boss_error", message: error.message });
}

export const makePgBoss = <const TIdentifier extends string>(identifier: TIdentifier): PgBossDefinition<TIdentifier> => {
	const Service = Context.Service<TIdentifier, PgBossService>(identifier);

	const layer = <const TRegistrations extends readonly JobRegistration[], TErrorRequirements = never>(
		options: PgBossLayerOptions<TRegistrations, TErrorRequirements>,
	): Layer.Layer<TIdentifier, PgBossError | PgBossQueueOptionsError, RegistrationRequirements<TRegistrations> | TErrorRequirements> => {
		type Requirements = RegistrationRequirements<TRegistrations> | TErrorRequirements;
		const names = options.jobs.map(registrationName);
		const { clientFactory, clientCacheKey, jobs, onError, stop, ...constructorOptions } = options;

		const acquire = Effect.acquireRelease(
			Effect.gen(function* () {
				const context = yield* Effect.context<Requirements>();
				const acquired = yield* acquireClient({
					clientCacheKey,
					clientFactory,
					constructor: constructorOptions,
				});
				const reportError: (error: Error) => Effect.Effect<unknown, never, Requirements> = onError ?? logClientError;
				const errorListener = (error: Error) => {
					void Effect.runPromise(Effect.exit(Effect.provide(reportError(error), context)));
				};
				acquired.client.on("error", errorListener);
				const registration = registerJobs(acquired.client, jobs, context, acquired.reused);
				return yield* registration.pipe(
					Effect.as({ acquired, context, errorListener }),
					Effect.onError(() => {
						acquired.client.off("error", errorListener);
						return releaseClient(acquired, stop);
					}),
				);
			}),
			(resource) => {
				resource.acquired.client.off("error", resource.errorListener);
				return releaseClient(resource.acquired, stop);
			},
		);

		return Layer.effect(
			Service,
			Effect.map(acquire, ({ acquired }) => makeService(acquired.client, names, constructorOptions.schema)),
		);
	};

	return Object.assign(Service, { layer });
};
