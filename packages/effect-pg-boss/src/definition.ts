import type { Effect, Schema } from "effect";
import type { Job, QueueOptions, ScheduleOptions, WorkOptions } from "pg-boss";

export interface JobPayloadSchema extends Schema.Top {
	readonly Encoded: object;
	readonly Type: object;
}

export interface JobContext {
	readonly id: string;
	readonly name: string;
	readonly signal: AbortSignal;
	readonly expireInSeconds: number;
	readonly heartbeatSeconds: number | null;
}

export interface QueueDefinition<
	Name extends string = string,
	Payload extends JobPayloadSchema = JobPayloadSchema,
> {
	readonly _tag: "QueueDefinition";
	readonly name: Name;
	readonly schema: Payload;
	readonly queueOptions: Omit<QueueOptions, "deadLetter">;
	readonly workerOptions: WorkOptions;
	readonly handle: <E, R>(
		handler: (
			payload: Schema.Schema.Type<Payload>,
			job: JobContext,
		) => Effect.Effect<unknown, E, R>,
	) => QueueWorker<Payload, R>;
}

export interface QueueWorker<
	Payload extends JobPayloadSchema = JobPayloadSchema,
	Requirements = unknown,
> {
	readonly _tag: "QueueWorker";
	readonly queue: QueueDefinition<string, Payload>;
	readonly handler: (
		payload: Schema.Schema.Type<Payload>,
		job: JobContext,
	) => Effect.Effect<unknown, unknown, Requirements>;
}

export interface JobRegistration {
	readonly _tag: "QueueWorker" | "ScheduledWorker";
}

export interface ScheduleDefinition<Name extends string = string> {
	readonly _tag: "ScheduleDefinition";
	readonly cron: string;
	readonly name: Name;
	readonly queueOptions: Omit<QueueOptions, "deadLetter">;
	readonly scheduleOptions: ScheduleOptions;
	readonly workerOptions: WorkOptions;
	readonly run: <E, R>(
		effect: Effect.Effect<unknown, E, R>,
	) => ScheduledWorker<R>;
}

export interface ScheduledWorker<Requirements = unknown> {
	readonly _tag: "ScheduledWorker";
	readonly schedule: ScheduleDefinition;
	readonly effect: Effect.Effect<unknown, unknown, Requirements>;
}

export type RegistrationRequirements<
	Registrations extends readonly JobRegistration[],
> = Registrations[number] extends infer Registration
	? Registration extends QueueWorker<infer Payload, infer Requirements>
		? Requirements | Payload["DecodingServices"]
		: Registration extends ScheduledWorker<infer Requirements>
			? Requirements
			: never
	: never;

export interface DefineQueueOptions<
	Name extends string,
	Payload extends JobPayloadSchema,
> {
	readonly name: Name;
	readonly schema: Payload;
	readonly queue?: Omit<QueueOptions, "deadLetter">;
	readonly worker?: WorkOptions;
}

export const defineQueue = <
	const Name extends string,
	const Payload extends JobPayloadSchema,
>(
	options: DefineQueueOptions<Name, Payload>,
): QueueDefinition<Name, Payload> => {
	const definition: QueueDefinition<Name, Payload> = {
		_tag: "QueueDefinition",
		name: options.name,
		queueOptions: Object.freeze({ ...options.queue }),
		schema: options.schema,
		workerOptions: Object.freeze({ batchSize: 1, ...options.worker }),
		handle: (handler) =>
			Object.freeze({
				_tag: "QueueWorker" as const,
				handler,
				queue: definition,
			}),
	};
	return Object.freeze(definition);
};

export interface DefineScheduleOptions<Name extends string> {
	readonly cron: string;
	readonly name: Name;
	readonly queue?: Omit<QueueOptions, "deadLetter">;
	readonly schedule?: ScheduleOptions;
	readonly worker?: WorkOptions;
}

export const defineSchedule = <const Name extends string>(
	options: DefineScheduleOptions<Name>,
): ScheduleDefinition<Name> => {
	const definition: ScheduleDefinition<Name> = {
		_tag: "ScheduleDefinition",
		cron: options.cron,
		name: options.name,
		queueOptions: Object.freeze({ ...options.queue }),
		scheduleOptions: Object.freeze({ tz: "UTC", ...options.schedule }),
		workerOptions: Object.freeze({ batchSize: 1, ...options.worker }),
		run: (effect) =>
			Object.freeze({
				_tag: "ScheduledWorker" as const,
				effect,
				schedule: definition,
			}),
	};
	return Object.freeze(definition);
};

export const jobContext = (job: Job<unknown>): JobContext => ({
	expireInSeconds: job.expireInSeconds,
	heartbeatSeconds: job.heartbeatSeconds,
	id: job.id,
	name: job.name,
	signal: job.signal,
});
