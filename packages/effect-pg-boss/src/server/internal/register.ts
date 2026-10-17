import { type Context, Effect, Redacted, Schema } from "effect";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { type JobRegistration, jobContext, type QueueDefinition, type QueueWorker, type ScheduledWorker } from "#definition.ts";
import { PgBossPayloadError, PgBossQueueOptionsError, toPgBossError } from "#error.ts";
import { ensureQueue } from "#internal/ensureQueue.ts";
import { payloadOf, traceJob } from "#internal/tracing.ts";

function isQueueWorker(registration: JobRegistration): registration is QueueWorker {
	return registration._tag === "QueueWorker";
}

function isScheduledWorker(registration: JobRegistration): registration is ScheduledWorker {
	return registration._tag === "ScheduledWorker";
}

function isQueueDefinition(registration: JobRegistration): registration is QueueDefinition {
	return registration._tag === "QueueDefinition";
}

export const registrationName = (registration: JobRegistration): string => {
	if (isQueueDefinition(registration)) {
		return registration.name;
	}
	if (isQueueWorker(registration)) {
		return registration.queue.name;
	}
	if (isScheduledWorker(registration)) {
		return registration.schedule.name;
	}
	throw new TypeError(`Unknown pg-boss registration: ${registration._tag}`);
};

// The layer requires RegistrationRequirements of its jobs, so its context provides every registered worker.
function workerContext<R>(context: Context.Context<R>): Context.Context<unknown>;
function workerContext(context: unknown): unknown {
	return context;
}

function runQueueWorker(worker: QueueWorker, job: Job<unknown>, context: Context.Context<unknown>): Promise<unknown> {
	return Effect.runPromise(
		Schema.decodeUnknownEffect(worker.queue.schema)(payloadOf(job.data)).pipe(
			Effect.mapError(
				(error) =>
					new PgBossPayloadError({
						direction: "decode",
						original: Redacted.make(error),
						queue: worker.queue.name,
					}),
			),
			Effect.flatMap((payload) => worker.handler(payload, jobContext(job))),
			(effect) => traceJob(effect, job, worker.queue.name),
			Effect.provide(context),
		),
		{ signal: job.signal },
	);
}

async function registerQueue(
	client: PgBossClient,
	registration: QueueWorker | QueueDefinition,
	context: Context.Context<unknown>,
	replaceWorker: boolean,
): Promise<void> {
	const queue = registration._tag === "QueueWorker" ? registration.queue : registration;
	const name = queue.name;
	if (replaceWorker && registration._tag === "QueueWorker") {
		await client.offWork(name);
	}
	await ensureQueue(client, name, queue.queueOptions);
	if (registration._tag === "QueueDefinition") {
		return;
	}
	await client.work(name, queue.workerOptions, async (jobs) => {
		for (const job of jobs) {
			await runQueueWorker(registration, job, context);
		}
	});
}

async function registerSchedule(
	client: PgBossClient,
	worker: ScheduledWorker,
	context: Context.Context<unknown>,
	replaceWorker: boolean,
): Promise<void> {
	const { schedule } = worker;
	if (replaceWorker) {
		await client.offWork(schedule.name);
	}
	await ensureQueue(client, schedule.name, schedule.queueOptions);
	await client.work(schedule.name, schedule.workerOptions, async (jobs: readonly Job<unknown>[]) => {
		for (const job of jobs) {
			await Effect.runPromise(Effect.provide(traceJob(worker.effect, job, schedule.name), context), {
				signal: job.signal,
			});
		}
	});
	await client.schedule(schedule.name, schedule.cron, null, schedule.scheduleOptions);
}

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
): Effect.Effect<void, import("#error.ts").PgBossError | PgBossQueueOptionsError> =>
	Effect.tryPromise({
		catch: (error) => (error instanceof PgBossQueueOptionsError ? error : toPgBossError("register", error)),
		try: async () => {
			registrationNames(registrations);
			const provided = workerContext(context);
			for (const registration of registrations) {
				if (isQueueWorker(registration) || isQueueDefinition(registration)) {
					await registerQueue(client, registration, provided, replaceWorkers);
				} else if (isScheduledWorker(registration)) {
					await registerSchedule(client, registration, provided, replaceWorkers);
				}
			}
		},
	});
