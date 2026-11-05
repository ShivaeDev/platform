import { Clock, Duration, Effect, Schema } from "effect";
import type { QueueDisplay, SubjectColumn } from "#display.ts";
import { maxDeferrals, nativeQueueOptions } from "#server/definitionOptions.ts";
import type { ScheduleOptions } from "#server/enqueueOptions.ts";
import type { WorkerJob } from "#server/job.ts";
import type { QueueOptions, QueuePolicy } from "#server/queueOptions.ts";
import type { WorkerOptions } from "#server/workerOptions.ts";

export class RetryAt extends Schema.TaggedError<RetryAt>()("RetryAt", {
	at: Schema.DateTimeUtc,
	reason: Schema.String,
}) {}

export interface JobPayloadSchema extends Schema.Top {
	readonly Encoded: object;
	readonly Type: object;
}

export interface JobContext {
	readonly deferralCount: number;
	readonly expireInSeconds: number;
	readonly heartbeatSeconds: number | null;
	readonly id: string;
	readonly name: string;
	readonly remainingBudget: Effect.Effect<Duration.Duration>;
	readonly retryCount: number;
	readonly signal: AbortSignal;
}

export interface QueueDefinition<TName extends string = string, TPayload extends JobPayloadSchema = JobPayloadSchema> extends QueueDisplay {
	readonly _tag: "QueueDefinition";
	readonly handle: <E, R>(
		handler: (payload: Schema.Schema.Type<TPayload>, job: JobContext) => Effect.Effect<unknown, E, R>,
	) => QueueWorker<TPayload, R>;
	readonly id?: readonly string[] | undefined;
	readonly key?: readonly string[] | undefined;
	readonly maxDeferrals: number;
	readonly name: TName;
	readonly queueOptions: Omit<QueueOptions, "maxDeferrals">;
	readonly schema: TPayload;
	readonly workerOptions: WorkerOptions;
}

export interface QueueWorker<TPayload extends JobPayloadSchema = JobPayloadSchema, TRequirements = unknown> {
	readonly _tag: "QueueWorker";
	readonly handler: (payload: Schema.Schema.Type<TPayload>, job: JobContext) => Effect.Effect<unknown, unknown, TRequirements>;
	readonly queue: QueueDefinition<string, TPayload>;
}

export type JobRegistration<TRequirements = unknown> =
	| QueueDefinition
	| QueueWorker<JobPayloadSchema & { readonly DecodingServices: TRequirements }, TRequirements>
	| ScheduledWorker<TRequirements>;

export interface ScheduleDefinition<TName extends string = string> extends QueueDisplay {
	readonly _tag: "ScheduleDefinition";
	readonly cron: string;
	readonly maxDeferrals: number;
	readonly name: TName;
	readonly queueOptions: Omit<QueueOptions, "maxDeferrals">;
	readonly run: <E, R>(effect: Effect.Effect<unknown, E, R>) => ScheduledWorker<R>;
	readonly scheduleOptions: ScheduleOptions;
	readonly workerOptions: WorkerOptions;
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

export type PayloadParts<TPayload extends JobPayloadSchema> = readonly {
	[TField in Extract<keyof TPayload["Type"], string>]: TPayload["Type"][TField] extends string | number | boolean | null ? TField : never;
}[Extract<keyof TPayload["Type"], string>][];

export type DefineQueueOptions<TName extends string, TPayload extends JobPayloadSchema> = {
	readonly id?: PayloadParts<NoInfer<TPayload>>;
	readonly label?: string;
	readonly name: TName;
	readonly schema: TPayload;
	readonly subject?: readonly SubjectColumn<NoInfer<TPayload>>[];
	readonly worker?: WorkerOptions;
} & (
	| { readonly key: PayloadParts<NoInfer<TPayload>>; readonly queue: QueueOptions & { readonly policy: "singleton" } }
	| { readonly key?: never; readonly queue?: QueueOptions & { readonly policy?: Exclude<QueuePolicy, "singleton"> } }
);

export function defineQueue<
	const TName extends string,
	const TPayload extends JobPayloadSchema,
	const TId extends readonly string[] | undefined = undefined,
	const TKey extends readonly string[] | undefined = undefined,
>(
	options: DefineQueueOptions<TName, TPayload> & { readonly id?: TId; readonly key?: TKey },
): QueueDefinition<TName, TPayload> & { readonly id?: TId; readonly key?: TKey };
export function defineQueue<const TName extends string, const TPayload extends JobPayloadSchema>(
	options: DefineQueueOptions<TName, TPayload>,
): QueueDefinition<TName, TPayload> {
	const definition: QueueDefinition<TName, TPayload> = {
		_tag: "QueueDefinition",
		id: options.id === undefined ? undefined : Object.freeze([...options.id]),
		...(options.key === undefined ? {} : { key: Object.freeze([...options.key]) }),
		...(options.label === undefined ? {} : { label: options.label }),
		...(options.subject === undefined ? {} : { subject: Object.freeze(options.subject.map((column) => Object.freeze({ ...column }))) }),
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
	readonly label?: string;
	readonly name: TName;
	readonly queue?: QueueOptions;
	readonly schedule?: ScheduleOptions;
	readonly worker?: WorkerOptions;
}

export function jobContext(job: WorkerJob<unknown>, deadline: number, deferralCount = 0): JobContext {
	return {
		deferralCount,
		expireInSeconds: job.expireInSeconds,
		heartbeatSeconds: job.heartbeatSeconds,
		id: job.id,
		name: job.name,
		remainingBudget: Effect.map(Clock.currentTimeMillis, (now) => Duration.millis(Math.max(0, deadline - now))),
		retryCount: job.retryCount,
		signal: job.signal,
	};
}
