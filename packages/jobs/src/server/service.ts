import { Context, type Effect, Layer, type Option, type Redacted, type Schema } from "effect";
import { acquireClient } from "#server/acquireClient.ts";
import type { PgBossClientFactory } from "#server/adapters/client.ts";
import { clientEngine } from "#server/adapters/lifecycle.ts";
import { pgBossDefinitionLayer } from "#server/adapters/pgBossDefinitionLayer.ts";
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
import type { Job } from "#server/job.ts";
import { ClientEngine } from "#server/lifecycle.ts";
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
	readonly runScheduleNow: (
		schedule: Pick<ScheduleDefinition, "name" | "scheduleOptions">,
	) => Effect.Effect<Option.Option<string>, PgBossError | PgBossNotFoundError>;
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

export function pgBossLayer(options: PgBossOptions): Layer.Layer<PgBoss, PgBossError | PgBossClientOptionsError> {
	return Layer.effect(PgBoss, acquireClient(options)).pipe(Layer.provide(Layer.succeed(ClientEngine, clientEngine)));
}

export function makePgBoss<const TIdentifier extends string>(identifier: TIdentifier, queueNames?: readonly string[]): PgBossDefinition<TIdentifier> {
	const Service = Context.Service<TIdentifier, PgBossService>(identifier);
	function layer<const TRegistrations extends readonly JobRegistration[], E = never>(options: PgBossLayerOptions<TRegistrations, E>) {
		return pgBossDefinitionLayer(Service, options, queueNames);
	}
	return Object.assign(Service, { layer });
}
