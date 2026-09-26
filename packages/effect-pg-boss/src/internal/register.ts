import { type Context, Effect, Redacted, Schema } from "effect";
import type { Job } from "pg-boss";
import { type JobRegistration, jobContext, type QueueWorker, type ScheduledWorker } from "../definition.ts";
import { PgBossPayloadError, toPgBossError } from "../error.ts";
import { deadLetterQueueName } from "../health.ts";
import type { PgBossClient } from "./client.ts";

const queueOptions = (options: Readonly<Record<string, unknown>>) => ({
	retryBackoff: true,
	retryLimit: 3,
	...options,
});

const isQueueWorker = (registration: JobRegistration): registration is QueueWorker => registration._tag === "QueueWorker";

const isScheduledWorker = (registration: JobRegistration): registration is ScheduledWorker => registration._tag === "ScheduledWorker";

export const registrationName = (registration: JobRegistration): string => {
	if (isQueueWorker(registration)) return registration.queue.name;
	if (isScheduledWorker(registration)) return registration.schedule.name;
	throw new TypeError(`Unknown pg-boss registration: ${registration._tag}`);
};

// The layer requires RegistrationRequirements of its jobs, so its context provides every registered worker.
function workerContext<R>(context: Context.Context<R>): Context.Context<unknown>;
function workerContext(context: unknown): unknown {
	return context;
}

const runQueueWorker = (worker: QueueWorker, job: Job<unknown>, context: Context.Context<unknown>): Promise<unknown> =>
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
		),
		{ signal: job.signal },
	);

const registerQueue = async (client: PgBossClient, worker: QueueWorker, context: Context.Context<unknown>, replaceWorker: boolean): Promise<void> => {
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

const registerSchedule = async (
	client: PgBossClient,
	worker: ScheduledWorker,
	context: Context.Context<unknown>,
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
	await client.work(schedule.name, schedule.workerOptions, async (jobs: readonly Job<unknown>[]) => {
		for (const job of jobs) {
			await Effect.runPromise(Effect.provide(worker.effect, context), {
				signal: job.signal,
			});
		}
	});
	await client.schedule(schedule.name, schedule.cron, null, schedule.scheduleOptions);
};

export const registrationNames = (registrations: readonly JobRegistration[]): readonly string[] => {
	const names = registrations.map(registrationName);
	if (new Set(names).size !== names.length) {
		throw new TypeError("pg-boss job names must be unique");
	}
	return names;
};

export const registerJobs = <R>(
	client: PgBossClient,
	registrations: readonly JobRegistration[],
	context: Context.Context<R>,
	replaceWorkers: boolean,
): Effect.Effect<void, import("../error.ts").PgBossError> =>
	Effect.tryPromise({
		try: async () => {
			registrationNames(registrations);
			const provided = workerContext(context);
			for (const registration of registrations) {
				if (isQueueWorker(registration)) {
					await registerQueue(client, registration, provided, replaceWorkers);
				} else if (isScheduledWorker(registration)) {
					await registerSchedule(client, registration, provided, replaceWorkers);
				}
			}
		},
		catch: (error) => toPgBossError("register", error),
	});
