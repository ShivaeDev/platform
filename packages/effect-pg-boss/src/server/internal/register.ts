import { type Context, Effect, Redacted, Schema, type Scope } from "effect";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import {
	type JobRegistration,
	jobContext,
	type QueueDefinition,
	type QueueWorker,
	type ScheduleDefinition,
	type ScheduledWorker,
} from "#definition.ts";
import { PgBossError, PgBossPayloadError, PgBossQueueOptionsError, toPgBossError } from "#error.ts";
import { ensureQueue } from "#internal/ensureQueue.ts";
import { registerWorker } from "#internal/registerWorker.ts";
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

function registrationDefinition(registration: JobRegistration): QueueDefinition | ScheduleDefinition {
	if (isQueueDefinition(registration)) {
		return registration;
	}
	if (isQueueWorker(registration)) {
		return registration.queue;
	}
	if (isScheduledWorker(registration)) {
		return registration.schedule;
	}
	throw new TypeError(`Unknown pg-boss registration: ${registration._tag}`);
}

export function registrationName(registration: JobRegistration): string {
	return registrationDefinition(registration).name;
}

async function prepareQueues(client: PgBossClient, registrations: readonly JobRegistration[], replaceWorkers: boolean): Promise<void> {
	for (const registration of registrations) {
		if (replaceWorkers && !isQueueDefinition(registration)) {
			await client.offWork(registrationName(registration));
		}
	}
	for (const registration of registrations) {
		const definition = registrationDefinition(registration);
		try {
			await ensureQueue(client, definition.name, definition.queueOptions);
		} catch (error) {
			throw error instanceof PgBossQueueOptionsError ? error : toPgBossError("register", error, definition.name);
		}
	}
}

// The layer requires RegistrationRequirements of its jobs, so its context provides every registered worker.
function workerContext<R>(context: Context.Context<R>): Context.Context<unknown>;
function workerContext(context: unknown): unknown {
	return context;
}

function runQueueWorker(worker: QueueWorker, job: Job<unknown>, context: Context.Context<unknown>) {
	return Schema.decodeUnknownEffect(worker.queue.schema)(payloadOf(job.data)).pipe(
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
	);
}

async function registerQueue(
	client: PgBossClient,
	registration: QueueWorker | QueueDefinition,
	context: Context.Context<unknown>,
	scope: Scope.Scope,
): Promise<void> {
	const queue = registration._tag === "QueueWorker" ? registration.queue : registration;
	const name = queue.name;
	if (registration._tag === "QueueDefinition") {
		return;
	}
	await registerWorker(client, name, queue.workerOptions, (job) => runQueueWorker(registration, job, context), scope);
}

async function registerSchedule(client: PgBossClient, worker: ScheduledWorker, context: Context.Context<unknown>, scope: Scope.Scope): Promise<void> {
	const { schedule } = worker;
	await registerWorker(
		client,
		schedule.name,
		schedule.workerOptions,
		(job) => Effect.provide(traceJob(worker.effect, job, schedule.name), context),
		scope,
	);
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
): Effect.Effect<void, PgBossError | PgBossQueueOptionsError, Scope.Scope> =>
	Effect.flatMap(Effect.scope, (scope) =>
		Effect.tryPromise({
			catch: (error) => (error instanceof PgBossQueueOptionsError || error instanceof PgBossError ? error : toPgBossError("register", error)),
			try: async () => {
				registrationNames(registrations);
				await prepareQueues(client, registrations, replaceWorkers);
				const provided = workerContext(context);
				for (const registration of registrations) {
					if (isQueueWorker(registration) || isQueueDefinition(registration)) {
						await registerQueue(client, registration, provided, scope);
					} else if (isScheduledWorker(registration)) {
						await registerSchedule(client, registration, provided, scope);
					}
				}
			},
		}),
	);
