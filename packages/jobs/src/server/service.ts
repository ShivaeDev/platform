import { Context, Effect, Exit, Layer, type Option, type Redacted, type Schema, Scope } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { clientErrorReporter } from "#server/adapters/clientErrorReporter.ts";
import { jobEngine } from "#server/adapters/jobEngine.ts";
import { clientEngine } from "#server/adapters/lifecycle.ts";
import type { PgBossClientFactory } from "#server/client.ts";
import type { ClientOptions, StopOptions } from "#server/clientOptions.ts";
import type { JobPayloadSchema, JobRegistration, QueueDefinition, RegistrationRequirements, ScheduleDefinition } from "#server/definition.ts";
import type { QueueEnqueueOptions } from "#server/enqueueOptions.ts";
import type {
	PgBossClientOptionsError,
	PgBossError,
	PgBossNotFoundError,
	PgBossPayloadError,
	PgBossQueueNamesError,
	PgBossQueueOptionsError,
} from "#server/error.ts";
import type { DeadLetteredJob, JobPage, JobPageOptions, JobsHealth, ListedJob, QueueCounts } from "#server/health.ts";
import type { PgBossInspectionService } from "#server/inspection.ts";
import { acquireClient } from "#server/internal/acquireClient.ts";
import { logClientError, subscribeClientErrors } from "#server/internal/clientErrors.ts";
import { JobEngine } from "#server/internal/engine.ts";
import { ClientEngine } from "#server/internal/lifecycle.ts";
import { makeService } from "#server/internal/makeService.ts";
import { registrationName } from "#server/internal/register.ts";
import { registerReleasedJobs } from "#server/internal/registerReleasedJobs.ts";
import { validateQueueNames } from "#server/internal/validateQueueNames.ts";
import type { Job } from "#server/job.ts";
import { PgBoss } from "#server/PgBoss.ts";

export interface PgBossService {
	readonly counts: (queue: Pick<QueueDefinition, "name">) => Effect.Effect<QueueCounts, PgBossError>;
	readonly deadLetteredJobs: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		options: JobPageOptions,
	) => Effect.Effect<JobPage<DeadLetteredJob<unknown>>, PgBossError | PgBossPayloadError | Schema.SchemaError, TPayload["DecodingServices"]>;
	readonly deleteQueue: (queue: Pick<QueueDefinition, "name">) => Effect.Effect<void, PgBossError | PgBossNotFoundError>;
	readonly enqueue: <const TName extends string, const TPayload extends JobPayloadSchema, const TQueue extends QueueDefinition<TName, TPayload>>(
		queue: QueueDefinition<TName, TPayload> & TQueue,
		payload: NoInfer<Schema.Schema.Type<TPayload>>,
		options?: NoInfer<QueueEnqueueOptions<TQueue>>,
	) => Effect.Effect<Option.Option<string>, PgBossError | PgBossPayloadError, TPayload["EncodingServices"]>;
	readonly failedJobs: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		options: JobPageOptions,
	) => Effect.Effect<JobPage<ListedJob<unknown>>, PgBossError | PgBossPayloadError | Schema.SchemaError, TPayload["DecodingServices"]>;
	readonly getJob: <const TName extends string, const TPayload extends JobPayloadSchema | typeof Schema.Null>(
		queue: { readonly name: TName; readonly schema: TPayload },
		id: string,
	) => Effect.Effect<Option.Option<Job<unknown>>, PgBossError | PgBossPayloadError, TPayload["DecodingServices"]>;
	readonly health: (queues?: readonly Pick<QueueDefinition, "name">[]) => Effect.Effect<JobsHealth, PgBossError>;
	readonly inspection: () => Effect.Effect<PgBossInspectionService>;
	readonly refreshQueueStats: (queue?: Pick<QueueDefinition, "name">) => Effect.Effect<void, PgBossError>;
	readonly retry: (queue: Pick<QueueDefinition, "name">, id: string) => Effect.Effect<void, PgBossError>;
	readonly unschedule: (schedule: Pick<ScheduleDefinition, "name" | "scheduleOptions">) => Effect.Effect<void, PgBossError | PgBossNotFoundError>;
}

export type PgBossOptions = Omit<ClientOptions, "connectionString"> & {
	readonly connectionString?: Redacted.Redacted<string>;
	readonly idleTimeoutMillis?: number;
	readonly maxLifetimeSeconds?: number;
	readonly clientFactory?: PgBossClientFactory;
	readonly clientCacheKey?: string | symbol | undefined;
	readonly stop?: StopOptions;
};

export function pgBossLayer(options: PgBossOptions): Layer.Layer<PgBoss, PgBossError | PgBossClientOptionsError> {
	return Layer.effect(PgBoss, acquireClient(options)).pipe(Layer.provide(Layer.succeed(ClientEngine, clientEngine)));
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
	function definition<R, E>(
		options: PgBossLayerOptions<readonly JobRegistration<R>[], E>,
		dependencies: Context.Context<Exclude<R, TIdentifier> | E>,
	) {
		return defineService({
			id: identifier,
			initialize: Effect.gen(function* () {
				yield* validateQueueNames(options.jobs, queueNames);
				const acquired = yield* PgBoss;
				const workerScope = yield* Scope.make();
				const service = yield* makeService(acquired.client, options.jobs.map(registrationName), acquired.schema).pipe(
					Effect.provideService(JobEngine, jobEngine(acquired.client, acquired.schema)),
				);
				yield* Effect.gen(function* () {
					const context = yield* Effect.context<R | E>();
					const reportError = options.onError ?? logClientError;
					const report = yield* clientErrorReporter(reportError).pipe(Effect.provide(context));
					const unsubscribe = subscribeClientErrors(acquired.client, report);
					yield* Effect.addFinalizer(() => Scope.close(workerScope, Exit.void).pipe(Effect.ensuring(Effect.sync(unsubscribe))));
					yield* registerReleasedJobs(acquired.client, options.jobs, context, acquired.reused, acquired.schema, acquired.stop, options.retired).pipe(
						Effect.provideService(Scope.Scope, workerScope),
					);
				}).pipe(Effect.provideService(Service, service), Effect.provide(dependencies));
				return service;
			}),
			methods: (service) => ({
				counts: service.counts,
				deadLetteredJobs: genericMethod(service.deadLetteredJobs),
				deleteQueue: service.deleteQueue,
				enqueue: genericMethod(service.enqueue),
				failedJobs: genericMethod(service.failedJobs),
				getJob: genericMethod(service.getJob),
				health: service.health,
				inspection: service.inspection,
				refreshQueueStats: service.refreshQueueStats,
				retry: service.retry,
				unschedule: service.unschedule,
			}),
			requires: [PgBoss],
		});
	}
	const Service: Context.Service<TIdentifier, PgBossService> = definition<never, never>({ jobs: [] }, Context.empty());
	function layer<const TRegistrations extends readonly JobRegistration[], E = never>(
		options: PgBossLayerOptions<TRegistrations, E>,
	): Layer.Layer<
		TIdentifier,
		PgBossError | PgBossQueueNamesError | PgBossQueueOptionsError,
		PgBoss | Exclude<RegistrationRequirements<TRegistrations>, TIdentifier> | E
	>;
	function layer<R = never, E = never>(options: PgBossLayerOptions<readonly JobRegistration<R>[], E>) {
		return Layer.unwrap(Effect.map(Effect.context<Exclude<R, TIdentifier> | E>(), (dependencies) => definition(options, dependencies).layer));
	}
	return Object.assign(Service, { layer });
}
