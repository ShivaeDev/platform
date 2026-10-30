import { Context, Effect, Exit, Layer, type Option, Redacted, type Schema, Scope } from "effect";
import type { ConstructorOptions, JobWithMetadata, SendOptions, StopOptions } from "pg-boss";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import type { PgBossClientFactory } from "#client.ts";
import type { JobPayloadSchema, JobRegistration, QueueDefinition, RegistrationRequirements } from "#definition.ts";
import type { PgBossClientOptionsError, PgBossError, PgBossPayloadError, PgBossQueueOptionsError } from "#error.ts";
import type { DeadLetteredJob, JobPage, JobPageOptions, JobsHealth, ListedJob, QueueCounts } from "#health.ts";
import { logClientError, subscribeClientErrors } from "#internal/clientErrors.ts";
import { acquireClient, releaseClient } from "#internal/lifecycle.ts";
import { makeService } from "#internal/makeService.ts";
import { registrationName } from "#internal/register.ts";
import { registerReleasedJobs } from "#internal/registerReleasedJobs.ts";
import { PgBoss } from "#PgBoss.ts";

export interface PgBossService {
	readonly counts: (queue: Pick<QueueDefinition, "name">) => Effect.Effect<QueueCounts, PgBossError>;
	readonly deadLetteredJobs: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		options: JobPageOptions,
	) => Effect.Effect<JobPage<DeadLetteredJob<TPayload["Type"]>>, PgBossError | PgBossPayloadError | Schema.SchemaError, TPayload["DecodingServices"]>;
	readonly enqueue: <const TName extends string, const TPayload extends JobPayloadSchema, const TQueue extends QueueDefinition<TName, TPayload>>(
		queue: QueueDefinition<TName, TPayload> & TQueue,
		payload: NoInfer<Schema.Schema.Type<TPayload>>,
		options?: NoInfer<TQueue["key"] extends undefined ? SendOptions : Omit<SendOptions, "singletonKey"> & { readonly singletonKey?: never }>,
	) => Effect.Effect<Option.Option<string>, PgBossError | PgBossPayloadError, TPayload["EncodingServices"]>;
	readonly failedJobs: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		options: JobPageOptions,
	) => Effect.Effect<JobPage<ListedJob<TPayload["Type"]>>, PgBossError | PgBossPayloadError | Schema.SchemaError, TPayload["DecodingServices"]>;
	readonly getJob: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		id: string,
	) => Effect.Effect<Option.Option<JobWithMetadata<TPayload["Type"]>>, PgBossError | PgBossPayloadError, TPayload["DecodingServices"]>;
	readonly health: () => Effect.Effect<JobsHealth, PgBossError>;
	readonly retry: (queue: Pick<QueueDefinition, "name">, id: string) => Effect.Effect<void, PgBossError>;
}

export type PgBossOptions = Omit<ConstructorOptions, "connectionString"> & {
	readonly connectionString?: Redacted.Redacted<string>;
	readonly clientFactory?: PgBossClientFactory;
	readonly clientCacheKey?: string | symbol | undefined;
	readonly stop?: StopOptions;
};

export function pgBossLayer(options: PgBossOptions): Layer.Layer<PgBoss, PgBossError | PgBossClientOptionsError> {
	const { connectionString, clientFactory, clientCacheKey, stop, ...settings } = options;
	return Layer.effect(
		PgBoss,
		Effect.gen(function* () {
			const dependencies = yield* Effect.context<never>();
			const execute = Effect.runPromiseWith(dependencies);
			const acquired = yield* Effect.acquireRelease(
				acquireClient(
					{
						clientCacheKey,
						clientFactory,
						constructor: {
							...settings,
							...(connectionString === undefined ? {} : { connectionString: Redacted.value(connectionString) }),
						},
					},
					(error) => {
						void execute(logClientError(error));
					},
				),
				(client) => releaseClient(client, stop),
			);
			return { ...acquired, schema: settings.schema, stop };
		}),
	);
}

export interface PgBossLayerOptions<TRegistrations extends readonly JobRegistration[], TErrorRequirements> {
	readonly jobs: TRegistrations;
	readonly onError?: (error: Error) => Effect.Effect<unknown, never, TErrorRequirements>;
}

export interface PgBossDefinition<TIdentifier extends string = string> extends Context.Service<TIdentifier, PgBossService> {
	readonly layer: <const TRegistrations extends readonly JobRegistration[], TErrorRequirements = never>(
		options: PgBossLayerOptions<TRegistrations, TErrorRequirements>,
	) => Layer.Layer<
		TIdentifier,
		PgBossError | PgBossQueueOptionsError,
		PgBoss | Exclude<RegistrationRequirements<TRegistrations>, TIdentifier> | TErrorRequirements
	>;
}

export function makePgBoss<const TIdentifier extends string>(identifier: TIdentifier): PgBossDefinition<TIdentifier> {
	function definition<R>(options: PgBossLayerOptions<readonly JobRegistration[], R>, dependencies: Context.Context<R>) {
		return defineService({
			id: identifier,
			initialize: Effect.gen(function* () {
				const acquired = yield* PgBoss;
				const execute = Effect.runPromiseWith(dependencies);
				const workerScope = yield* Scope.make();
				const service = makeService(acquired.client, options.jobs.map(registrationName), acquired.schema);
				const context = Context.add(dependencies, Service, service);
				const reportError = options.onError ?? logClientError;
				const unsubscribe = subscribeClientErrors(acquired.client, (error) => {
					void execute(Effect.exit(Effect.provide(reportError(error), context)));
				});
				yield* Effect.addFinalizer(() => Scope.close(workerScope, Exit.void).pipe(Effect.ensuring(Effect.sync(unsubscribe))));
				yield* registerReleasedJobs(
					acquired.client,
					options.jobs,
					context,
					acquired.reused,
					(effect) => execute(effect),
					acquired.schema,
					acquired.stop?.graceful !== false,
				).pipe(Effect.provideService(Scope.Scope, workerScope), Effect.provide(dependencies));
				return service;
			}),
			methods: (service) => ({
				counts: service.counts,
				deadLetteredJobs: genericMethod(service.deadLetteredJobs),
				enqueue: genericMethod(service.enqueue),
				failedJobs: genericMethod(service.failedJobs),
				getJob: genericMethod(service.getJob),
				health: service.health,
				retry: service.retry,
			}),
			requires: [PgBoss],
		});
	}
	const Service: Context.Service<TIdentifier, PgBossService> = definition({ jobs: [] }, Context.empty());
	function layer<const TRegistrations extends readonly JobRegistration[], TErrorRequirements = never>(
		options: PgBossLayerOptions<TRegistrations, TErrorRequirements>,
	) {
		type Requirements = Exclude<RegistrationRequirements<TRegistrations>, TIdentifier> | TErrorRequirements;
		return Layer.unwrap(Effect.map(Effect.context<Requirements>(), (dependencies) => definition(options, dependencies).layer));
	}
	return Object.assign(Service, { layer });
}
