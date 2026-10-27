import { Context, Effect, Layer, type Option, type Schema } from "effect";
import type { ConstructorOptions, JobWithMetadata, SendOptions, StopOptions } from "pg-boss";
import type { PgBossClientFactory } from "#client.ts";
import type { JobPayloadSchema, JobRegistration, QueueDefinition, RegistrationRequirements } from "#definition.ts";
import type { PgBossClientOptionsError, PgBossError, PgBossPayloadError, PgBossQueueOptionsError } from "#error.ts";
import type { DeadLetteredJob, JobPage, JobPageOptions, JobsHealth, ListedJob, QueueCounts } from "#health.ts";
import { logClientError, subscribeClientErrors } from "#internal/clientErrors.ts";
import { acquireClient, releaseClient } from "#internal/lifecycle.ts";
import { makeService } from "#internal/makeService.ts";
import { registrationName } from "#internal/register.ts";
import { registerReleasedJobs } from "#internal/registerReleasedJobs.ts";

export interface PgBossService {
	readonly counts: (queue: Pick<QueueDefinition, "name">) => Effect.Effect<QueueCounts, PgBossError>;
	readonly deadLetteredJobs: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		options: JobPageOptions,
	) => Effect.Effect<JobPage<DeadLetteredJob<TPayload["Type"]>>, PgBossError | PgBossPayloadError, TPayload["DecodingServices"]>;
	readonly enqueue: <const TName extends string, const TPayload extends JobPayloadSchema, const TQueue extends QueueDefinition<TName, TPayload>>(
		queue: QueueDefinition<TName, TPayload> & TQueue,
		payload: NoInfer<Schema.Schema.Type<TPayload>>,
		options?: NoInfer<TQueue["key"] extends undefined ? SendOptions : Omit<SendOptions, "singletonKey"> & { readonly singletonKey?: never }>,
	) => Effect.Effect<Option.Option<string>, PgBossError | PgBossPayloadError, TPayload["EncodingServices"]>;
	readonly failedJobs: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		options: JobPageOptions,
	) => Effect.Effect<JobPage<ListedJob<TPayload["Type"]>>, PgBossError | PgBossPayloadError, TPayload["DecodingServices"]>;
	readonly getJob: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		id: string,
	) => Effect.Effect<Option.Option<JobWithMetadata<TPayload["Type"]>>, PgBossError | PgBossPayloadError, TPayload["DecodingServices"]>;
	readonly health: Effect.Effect<JobsHealth, PgBossError>;
	readonly retry: (queue: Pick<QueueDefinition, "name">, id: string) => Effect.Effect<void, PgBossError>;
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
	) => Layer.Layer<
		TIdentifier,
		PgBossError | PgBossQueueOptionsError | PgBossClientOptionsError,
		Exclude<RegistrationRequirements<TRegistrations>, TIdentifier> | TErrorRequirements
	>;
}

export function makePgBoss<const TIdentifier extends string>(identifier: TIdentifier): PgBossDefinition<TIdentifier> {
	const Service = Context.Service<TIdentifier, PgBossService>(identifier);

	function layer<const TRegistrations extends readonly JobRegistration[], TErrorRequirements = never>(
		options: PgBossLayerOptions<TRegistrations, TErrorRequirements>,
	): Layer.Layer<
		TIdentifier,
		PgBossError | PgBossQueueOptionsError | PgBossClientOptionsError,
		Exclude<RegistrationRequirements<TRegistrations>, TIdentifier> | TErrorRequirements
	> {
		type Requirements = Exclude<RegistrationRequirements<TRegistrations>, TIdentifier> | TErrorRequirements;
		const names = options.jobs.map(registrationName);
		const { clientFactory, clientCacheKey, jobs, onError, stop, ...constructorOptions } = options;

		const acquire = Effect.acquireRelease(
			Effect.gen(function* () {
				const dependencies = yield* Effect.context<Requirements>();
				const acquired = yield* acquireClient({
					clientCacheKey,
					clientFactory,
					constructor: constructorOptions,
				});
				const service = makeService(acquired.client, names, constructorOptions.schema);
				const context = Context.add(dependencies, Service, service);
				const reportError: (error: Error) => Effect.Effect<unknown, never, Requirements | TIdentifier> = onError ?? logClientError;
				function errorListener(error: Error): void {
					void Effect.runPromise(Effect.exit(Effect.provide(reportError(error), context)));
				}
				const unsubscribe = subscribeClientErrors(acquired.client, errorListener);
				const registration = registerReleasedJobs(acquired.client, jobs, context, acquired.reused, constructorOptions.schema);
				return yield* registration.pipe(
					Effect.as({ acquired, service, unsubscribe }),
					Effect.onError(() => releaseClient(acquired, stop).pipe(Effect.ensuring(Effect.sync(unsubscribe)))),
				);
			}),
			(resource) => releaseClient(resource.acquired, stop).pipe(Effect.ensuring(Effect.sync(resource.unsubscribe))),
		);

		return Layer.effect(
			Service,
			Effect.map(acquire, ({ service }) => service),
		);
	}

	return Object.assign(Service, { layer });
}
