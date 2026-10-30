import { Clock, Duration, Effect, Schema } from "effect";
import type { Job, policies, Queue, ScheduleOptions, WorkOptions } from "pg-boss";
import { deadlineOf } from "#internal/deadlineOf.ts";
import { maxDeferrals, nativeQueueOptions } from "#internal/definitionOptions.ts";

export class RetryAt extends Schema.TaggedError<RetryAt>()("RetryAt", {
	at: Schema.DateTimeUtc,
	reason: Schema.String,
}) {}

export type QueuePolicy = (typeof policies)[keyof typeof policies];
export type QueueOptions = Omit<Queue, "name" | "deadLetter" | "policy"> & {
	readonly maxDeferrals?: number;
	readonly policy?: QueuePolicy;
};

export interface JobPayloadSchema extends Schema.Top {
	readonly Encoded: object;
	readonly Type: object;
}

export interface JobContext {
	readonly expireInSeconds: number;
	readonly heartbeatSeconds: number | null;
	readonly id: string;
	readonly name: string;
	readonly remainingBudget: Effect.Effect<Duration.Duration>;
	readonly signal: AbortSignal;
}

export interface QueueDefinition<TName extends string = string, TPayload extends JobPayloadSchema = JobPayloadSchema> {
	readonly _tag: "QueueDefinition";
	readonly handle: <E, R>(
		handler: (payload: Schema.Schema.Type<TPayload>, job: JobContext) => Effect.Effect<unknown, E, R>,
	) => QueueWorker<TPayload, R>;
	readonly key?: ((payload: Schema.Schema.Type<TPayload>) => string) | undefined;
	readonly maxDeferrals: number;
	readonly name: TName;
	readonly queueOptions: Omit<Queue, "name" | "deadLetter">;
	readonly schema: TPayload;
	readonly workerOptions: WorkOptions;
}

export interface QueueWorker<TPayload extends JobPayloadSchema = JobPayloadSchema, TRequirements = unknown> {
	readonly _tag: "QueueWorker";
	readonly handler: (payload: Schema.Schema.Type<TPayload>, job: JobContext) => Effect.Effect<unknown, unknown, TRequirements>;
	readonly queue: QueueDefinition<string, TPayload>;
}

export interface JobRegistration {
	readonly _tag: "QueueDefinition" | "QueueWorker" | "ScheduledWorker";
}

export interface ScheduleDefinition<TName extends string = string> {
	readonly _tag: "ScheduleDefinition";
	readonly cron: string;
	readonly maxDeferrals: number;
	readonly name: TName;
	readonly queueOptions: Omit<Queue, "name" | "deadLetter">;
	readonly run: <E, R>(effect: Effect.Effect<unknown, E, R>) => ScheduledWorker<R>;
	readonly scheduleOptions: ScheduleOptions;
	readonly workerOptions: WorkOptions;
}

export interface ScheduledWorker<TRequirements = unknown> {
	readonly _tag: "ScheduledWorker";
	readonly effect: Effect.Effect<unknown, unknown, TRequirements>;
	readonly schedule: ScheduleDefinition;
}

export type RegistrationRequirements<TRegistrations extends readonly JobRegistration[]> = TRegistrations[number] extends infer TRegistration
	? TRegistration extends QueueWorker<infer TPayload, infer TRequirements>
		? TRequirements | TPayload["DecodingServices"]
		: TRegistration extends ScheduledWorker<infer TRequirements>
			? TRequirements
			: never
	: never;

export type DefineQueueOptions<TName extends string, TPayload extends JobPayloadSchema> = {
	readonly name: TName;
	readonly schema: TPayload;
	readonly worker?: WorkOptions;
} & (
	| { readonly key: (payload: Schema.Schema.Type<TPayload>) => string; readonly queue: QueueOptions & { readonly policy: "singleton" } }
	| { readonly key?: never; readonly queue?: QueueOptions & { readonly policy?: Exclude<QueuePolicy, "singleton"> } }
);

export function defineQueue<const TName extends string, const TPayload extends JobPayloadSchema>(
	options: DefineQueueOptions<TName, TPayload> & { readonly key: (payload: Schema.Schema.Type<TPayload>) => string },
): QueueDefinition<TName, TPayload> & { readonly key: (payload: Schema.Schema.Type<TPayload>) => string };
export function defineQueue<const TName extends string, const TPayload extends JobPayloadSchema>(
	options: DefineQueueOptions<TName, TPayload> & { readonly key?: never },
): QueueDefinition<TName, TPayload> & { readonly key?: never };
export function defineQueue<const TName extends string, const TPayload extends JobPayloadSchema>(
	options: DefineQueueOptions<TName, TPayload>,
): QueueDefinition<TName, TPayload>;
export function defineQueue<const TName extends string, const TPayload extends JobPayloadSchema>(
	options: DefineQueueOptions<TName, TPayload>,
): QueueDefinition<TName, TPayload> {
	const definition: QueueDefinition<TName, TPayload> = {
		_tag: "QueueDefinition",
		...(options.key === undefined ? {} : { key: options.key }),
		handle: (handler) =>
			Object.freeze({
				_tag: "QueueWorker" as const,
				handler,
				queue: definition,
			}),
		maxDeferrals: maxDeferrals(options.queue),
		name: options.name,
		queueOptions: nativeQueueOptions(options.queue),
		schema: options.schema,
		workerOptions: Object.freeze({ batchSize: 10, burstWhenBatchFull: true, ...options.worker }),
	};
	return Object.freeze(definition);
}

export interface DefineScheduleOptions<TName extends string> {
	readonly cron: string;
	readonly name: TName;
	readonly queue?: QueueOptions;
	readonly schedule?: ScheduleOptions;
	readonly worker?: WorkOptions;
}

export function jobContext(job: Job<unknown>): JobContext {
	return {
		expireInSeconds: job.expireInSeconds,
		heartbeatSeconds: job.heartbeatSeconds,
		id: job.id,
		name: job.name,
		remainingBudget: Effect.map(Clock.currentTimeMillis, (now) => Duration.millis(Math.max(0, deadlineOf(job) - now))),
		signal: job.signal,
	};
}
