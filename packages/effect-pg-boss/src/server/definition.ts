import { Clock, Duration, Effect, Schema } from "effect";
import type { Job, Queue, ScheduleOptions, WorkOptions } from "pg-boss";
import { deadlineOf } from "#internal/deadlineOf.ts";

export class RetryAt extends Schema.TaggedError<RetryAt>()("RetryAt", {
	at: Schema.DateTimeUtc,
	reason: Schema.String,
}) {}

export type QueueOptions = Omit<Queue, "name" | "deadLetter"> & { readonly maxDeferrals?: number };

function maxDeferrals(options: QueueOptions | undefined): number {
	const limit = options?.maxDeferrals ?? 10;
	if (!Number.isSafeInteger(limit) || limit < 0) {
		throw new RangeError("maxDeferrals must be a nonnegative safe integer");
	}
	return limit;
}

function nativeQueueOptions(options: QueueOptions | undefined) {
	const { maxDeferrals: _limit, ...native } = options ?? {};
	return Object.freeze(native);
}

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

export interface QueueDefinition<Name extends string = string, Payload extends JobPayloadSchema = JobPayloadSchema> {
	readonly _tag: "QueueDefinition";
	readonly handle: <E, R>(
		handler: (payload: Schema.Schema.Type<Payload>, job: JobContext) => Effect.Effect<unknown, E, R>,
	) => QueueWorker<Payload, R>;
	readonly maxDeferrals: number;
	readonly name: Name;
	readonly queueOptions: Omit<Queue, "name" | "deadLetter">;
	readonly schema: Payload;
	readonly workerOptions: WorkOptions;
}

export interface QueueWorker<Payload extends JobPayloadSchema = JobPayloadSchema, Requirements = unknown> {
	readonly _tag: "QueueWorker";
	readonly handler: (payload: Schema.Schema.Type<Payload>, job: JobContext) => Effect.Effect<unknown, unknown, Requirements>;
	readonly queue: QueueDefinition<string, Payload>;
}

export interface JobRegistration {
	readonly _tag: "QueueDefinition" | "QueueWorker" | "ScheduledWorker";
}

export interface ScheduleDefinition<Name extends string = string> {
	readonly _tag: "ScheduleDefinition";
	readonly cron: string;
	readonly maxDeferrals: number;
	readonly name: Name;
	readonly queueOptions: Omit<Queue, "name" | "deadLetter">;
	readonly run: <E, R>(effect: Effect.Effect<unknown, E, R>) => ScheduledWorker<R>;
	readonly scheduleOptions: ScheduleOptions;
	readonly workerOptions: WorkOptions;
}

export interface ScheduledWorker<Requirements = unknown> {
	readonly _tag: "ScheduledWorker";
	readonly effect: Effect.Effect<unknown, unknown, Requirements>;
	readonly schedule: ScheduleDefinition;
}

export type RegistrationRequirements<Registrations extends readonly JobRegistration[]> = Registrations[number] extends infer Registration
	? Registration extends QueueWorker<infer Payload, infer Requirements>
		? Requirements | Payload["DecodingServices"]
		: Registration extends ScheduledWorker<infer Requirements>
			? Requirements
			: never
	: never;

export interface DefineQueueOptions<Name extends string, Payload extends JobPayloadSchema> {
	readonly name: Name;
	readonly queue?: QueueOptions;
	readonly schema: Payload;
	readonly worker?: WorkOptions;
}

export const defineQueue = <const Name extends string, const Payload extends JobPayloadSchema>(
	options: DefineQueueOptions<Name, Payload>,
): QueueDefinition<Name, Payload> => {
	const definition: QueueDefinition<Name, Payload> = {
		_tag: "QueueDefinition",
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
};

export interface DefineScheduleOptions<Name extends string> {
	readonly cron: string;
	readonly name: Name;
	readonly queue?: QueueOptions;
	readonly schedule?: ScheduleOptions;
	readonly worker?: WorkOptions;
}

export const defineSchedule = <const Name extends string>(options: DefineScheduleOptions<Name>): ScheduleDefinition<Name> => {
	const definition: ScheduleDefinition<Name> = {
		_tag: "ScheduleDefinition",
		cron: options.cron,
		maxDeferrals: maxDeferrals(options.queue),
		name: options.name,
		queueOptions: nativeQueueOptions(options.queue),
		run: (effect) =>
			Object.freeze({
				_tag: "ScheduledWorker" as const,
				effect,
				schedule: definition,
			}),
		scheduleOptions: Object.freeze({ tz: "UTC", ...options.schedule }),
		workerOptions: Object.freeze({ batchSize: 10, burstWhenBatchFull: true, ...options.worker }),
	};
	return Object.freeze(definition);
};

export const jobContext = (job: Job<unknown>): JobContext => ({
	expireInSeconds: job.expireInSeconds,
	heartbeatSeconds: job.heartbeatSeconds,
	id: job.id,
	name: job.name,
	remainingBudget: Effect.map(Clock.currentTimeMillis, (now) => Duration.millis(Math.max(0, deadlineOf(job) - now))),
	signal: job.signal,
});
