import { Effect, Redacted, Schema } from "effect";
import type { Job } from "pg-boss";
import {
	type JobPayloadSchema,
	type JobRegistration,
	jobContext,
	type QueueWorker,
	type ScheduledWorker,
} from "../definition.js";
import { PgBossPayloadError, toPgBossError } from "../error.js";
import { deadLetterQueueName } from "../health.js";
import type { PgBossClient } from "./client.js";

const queueOptions = (options: Readonly<Record<string, unknown>>) => ({
	retryBackoff: true,
	retryLimit: 3,
	...options,
});

const runQueueWorker = <R>(
	worker: QueueWorker<JobPayloadSchema, R>,
	job: Job<unknown>,
	context: import("effect").Context.Context<R>,
): Promise<unknown> =>
	Effect.runPromise(
		Schema.decodeUnknownEffect(worker.queue.schema)(job.data).pipe(
			Effect.mapError(
				(error) =>
					new PgBossPayloadError({
						direction: "decode",
						original: Redacted.make(error),
						queue: worker.queue.name,
					}),
			),
			Effect.flatMap((payload) => worker.handler(payload, jobContext(job))),
			Effect.provide(context),
		) as Effect.Effect<unknown, unknown>,
		{ signal: job.signal },
	);

const registerQueue = async <R>(
	client: PgBossClient,
	worker: QueueWorker<JobPayloadSchema, R>,
	context: import("effect").Context.Context<R>,
	replaceWorker: boolean,
): Promise<void> => {
	const name = worker.queue.name;
	const deadLetter = deadLetterQueueName(name);
	if (replaceWorker) await client.offWork(name);
	await client.createQueue(deadLetter);
	await client.createQueue(name, {
		...queueOptions(worker.queue.queueOptions),
		deadLetter,
	});
	await client.work(name, worker.queue.workerOptions, async (jobs) => {
		for (const job of jobs) await runQueueWorker(worker, job, context);
	});
};

const registerSchedule = async <R>(
	client: PgBossClient,
	worker: ScheduledWorker<R>,
	context: import("effect").Context.Context<R>,
	replaceWorker: boolean,
): Promise<void> => {
	const { schedule } = worker;
	const deadLetter = deadLetterQueueName(schedule.name);
	if (replaceWorker) await client.offWork(schedule.name);
	await client.createQueue(deadLetter);
	await client.createQueue(schedule.name, {
		...queueOptions(schedule.queueOptions),
		deadLetter,
	});
	await client.work(
		schedule.name,
		schedule.workerOptions,
		async (jobs: readonly Job<unknown>[]) => {
			for (const job of jobs) {
				await Effect.runPromise(Effect.provide(worker.effect, context), {
					signal: job.signal,
				});
			}
		},
	);
	await client.schedule(
		schedule.name,
		schedule.cron,
		null,
		schedule.scheduleOptions,
	);
};

export const registrationNames = (
	registrations: readonly JobRegistration[],
): readonly string[] => {
	const names = registrations.map((registration) =>
		registration._tag === "QueueWorker"
			? (registration as QueueWorker).queue.name
			: (registration as ScheduledWorker).schedule.name,
	);
	if (new Set(names).size !== names.length) {
		throw new TypeError("pg-boss job names must be unique");
	}
	return names;
};

export const registerJobs = <R>(
	client: PgBossClient,
	registrations: readonly JobRegistration[],
	context: import("effect").Context.Context<R>,
	replaceWorkers: boolean,
): Effect.Effect<void, import("../error.js").PgBossError> =>
	Effect.tryPromise({
		try: async () => {
			registrationNames(registrations);
			for (const registration of registrations) {
				if (registration._tag === "QueueWorker") {
					await registerQueue(
						client,
						registration as QueueWorker<JobPayloadSchema, R>,
						context,
						replaceWorkers,
					);
				} else {
					await registerSchedule(
						client,
						registration as ScheduledWorker<R>,
						context,
						replaceWorkers,
					);
				}
			}
		},
		catch: (error) => toPgBossError("register", error),
	});
