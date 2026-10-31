import { Context, Effect, Exit, Layer, type Option, Redacted, type Schema, Scope } from "effect";
import type { ConstructorOptions, JobWithMetadata, SendOptions, StopOptions } from "pg-boss";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { clientErrorReporter } from "#adapters/clientErrorReporter.ts";
import type { PgBossClientFactory } from "#client.ts";
import type { JobPayloadSchema, JobRegistration, QueueDefinition, RegistrationRequirements } from "#definition.ts";
import type { PgBossClientOptionsError, PgBossError, PgBossPayloadError, PgBossQueueNamesError, PgBossQueueOptionsError } from "#error.ts";
import type { DeadLetteredJob, JobPage, JobPageOptions, JobsHealth, ListedJob, QueueCounts } from "#health.ts";
import { logClientError, subscribeClientErrors } from "#internal/clientErrors.ts";
import { acquireClient, releaseClient } from "#internal/lifecycle.ts";
import { makeService } from "#internal/makeService.ts";
import { registrationName } from "#internal/register.ts";
import { registerReleasedJobs } from "#internal/registerReleasedJobs.ts";
import { validateQueueNames } from "#internal/validateQueueNames.ts";
import { PgBoss } from "#PgBoss.ts";

export interface PgBossService {
	readonly counts: (queue: Pick<QueueDefinition, "name">) => Effect.Effect<QueueCounts, PgBossError>;
	readonly deadLetteredJobs: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		options: JobPageOptions,
	) => Effect.Effect<JobPage<DeadLetteredJob<unknown>>, PgBossError | PgBossPayloadError | Schema.SchemaError, TPayload["DecodingServices"]>;
	readonly enqueue: <const TName extends string, const TPayload extends JobPayloadSchema, const TQueue extends QueueDefinition<TName, TPayload>>(
		queue: QueueDefinition<TName, TPayload> & TQueue,
		payload: NoInfer<Schema.Schema.Type<TPayload>>,
		options?: NoInfer<TQueue["key"] extends undefined ? SendOptions : Omit<SendOptions, "singletonKey"> & { readonly singletonKey?: never }>,
	) => Effect.Effect<Option.Option<string>, PgBossError | PgBossPayloadError, TPayload["EncodingServices"]>;
	readonly failedJobs: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		options: JobPageOptions,
	) => Effect.Effect<JobPage<ListedJob<unknown>>, PgBossError | PgBossPayloadError | Schema.SchemaError, TPayload["DecodingServices"]>;
	readonly getJob: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		id: string,
	) => Effect.Effect<Option.Option<JobWithMetadata<unknown>>, PgBossError | PgBossPayloadError, TPayload["DecodingServices"]>;
	readonly health: (queues?: readonly Pick<QueueDefinition, "name">[]) => Effect.Effect<JobsHealth, PgBossError>;
	readonly retry: (queue: Pick<QueueDefinition, "name">, id: string) => Effect.Effect<void, PgBossError>;
}

export type PgBossOptions = Omit<ConstructorOptions, "connectionString"> & {
	readonly connectionString?: Redacted.Redacted<string>;
	readonly idleTimeoutMillis?: number;
	readonly maxLifetimeSeconds?: number;
	readonly clientFactory?: PgBossClientFactory;
	readonly clientCacheKey?: string | symbol | undefined;
	readonly stop?: StopOptions;
};

export function pgBossLayer(options: PgBossOptions): Layer.Layer<PgBoss, PgBossError | PgBossClientOptionsError> {
	const { connectionString, clientFactory, clientCacheKey, stop, ...settings } = options;
	const constructorOptions = {
		...settings,
		idleTimeoutMillis: settings.idleTimeoutMillis ?? 60_000,
		maxLifetimeSeconds: settings.maxLifetimeSeconds ?? 600,
		...(connectionString === undefined ? {} : { connectionString: Redacted.value(connectionString) }),
	};
	return Layer.effect(
		PgBoss,
		Effect.gen(function* () {
			const report = yield* clientErrorReporter(logClientError);
			const acquired = yield* Effect.acquireRelease(
				acquireClient(
					{
						clientCacheKey,
						clientFactory,
						constructor: constructorOptions,
					},
					report,
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
	readonly retired?: readonly string[];
}

export interface PgBossDefinition<TIdentifier extends string = string> extends Context.Service<TIdentifier, PgBossService> {
	readonly layer: <const TRegistrations extends readonly JobRegistration[], TErrorRequirements = never>(
		options: PgBossLayerOptions<TRegistrations, TErrorRequirements>,
	) => Layer.Layer<
		TIdentifier,
		PgBossError | PgBossQueueNamesError | PgBossQueueOptionsError,
		PgBoss | Exclude<RegistrationRequirements<TRegistrations>, TIdentifier> | TErrorRequirements
	>;
}

export function makePgBoss<const TIdentifier extends string>(identifier: TIdentifier, queueNames?: readonly string[]): PgBossDefinition<TIdentifier> {
	function definition<R>(options: PgBossLayerOptions<readonly JobRegistration[], R>, dependencies: Context.Context<R>) {
		return defineService({
			id: identifier,
			initialize: Effect.gen(function* () {
				yield* validateQueueNames(options.jobs, queueNames);
				const acquired = yield* PgBoss;
				const workerScope = yield* Scope.make();
				const service = makeService(acquired.client, options.jobs.map(registrationName), acquired.schema);
				const context = Context.add(dependencies, Service, service);
				const reportError = options.onError ?? logClientError;
				const report = yield* clientErrorReporter(reportError).pipe(Effect.provide(context));
				const unsubscribe = subscribeClientErrors(acquired.client, report);
				yield* Effect.addFinalizer(() => Scope.close(workerScope, Exit.void).pipe(Effect.ensuring(Effect.sync(unsubscribe))));
				yield* registerReleasedJobs(
					acquired.client,
					options.jobs,
					context,
					acquired.reused,
					acquired.schema,
					acquired.stop?.graceful !== false,
					options.retired,
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
