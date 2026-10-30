import { type Context, Effect, type Scope } from "effect";
import type { PgBossClient } from "#client.ts";
import type { JobRegistration, QueueDefinition, QueueWorker, ScheduleDefinition, ScheduledWorker } from "#definition.ts";
import { PgBossQueueOptionsError, toPgBossError } from "#error.ts";
import type { PgBossRunner } from "#internal/batchHandler.ts";
import { ensureQueue } from "#internal/ensureQueue.ts";
import { registerWorker } from "#internal/registerWorker.ts";
import { runQueueWorker } from "#internal/runQueueWorker.ts";

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

const prepareQueues = Effect.fnUntraced(function* (client: PgBossClient, registrations: readonly JobRegistration[], replaceWorkers: boolean) {
	for (const registration of registrations) {
		if (replaceWorkers && !isQueueDefinition(registration)) {
			yield* Effect.tryPromise({ catch: (error) => toPgBossError("register", error), try: () => client.offWork(registrationName(registration)) });
		}
	}
	for (const registration of registrations) {
		const definition = registrationDefinition(registration);
		yield* ensureQueue(client, definition.name, definition.queueOptions).pipe(
			Effect.mapError((error) => (error instanceof PgBossQueueOptionsError ? error : toPgBossError("register", error, definition.name))),
		);
	}
});

// The layer requires RegistrationRequirements of its jobs, so its context provides every registered worker.
function workerContext<R>(context: Context.Context<R>): Context.Context<unknown>;
function workerContext(context: unknown): unknown {
	return context;
}

const registerQueue = Effect.fnUntraced(function* (
	client: PgBossClient,
	registration: QueueWorker | QueueDefinition,
	context: Context.Context<unknown>,
	scope: Scope.Scope,
	schema: string,
	execute: PgBossRunner,
	graceful: boolean,
) {
	const queue = registration._tag === "QueueWorker" ? registration.queue : registration;
	const name = queue.name;
	if (registration._tag === "QueueDefinition") {
		return;
	}
	yield* registerWorker(
		client,
		name,
		queue.workerOptions,
		(job) => runQueueWorker(registration, job),
		scope,
		schema,
		queue.maxDeferrals,
		context,
		execute,
		graceful,
	);
});

const registerSchedule = Effect.fnUntraced(function* (
	client: PgBossClient,
	worker: ScheduledWorker,
	context: Context.Context<unknown>,
	scope: Scope.Scope,
	schema: string,
	execute: PgBossRunner,
	graceful: boolean,
) {
	const { schedule } = worker;
	yield* registerWorker(
		client,
		schedule.name,
		schedule.workerOptions,
		() => worker.effect,
		scope,
		schema,
		schedule.maxDeferrals,
		context,
		execute,
		graceful,
	);
	yield* Effect.tryPromise({
		catch: (error) => toPgBossError("register", error, schedule.name),
		try: () => client.schedule(schedule.name, schedule.cron, null, schedule.scheduleOptions),
	});
});

export function registrationNames(registrations: readonly JobRegistration[]): readonly string[] {
	const names = registrations.map(registrationName);
	if (new Set(names).size !== names.length) {
		throw new TypeError("pg-boss job names must be unique");
	}
	return names;
}

export const registerJobs = Effect.fnUntraced(function* <R>(
	client: PgBossClient,
	registrations: readonly JobRegistration[],
	context: Context.Context<R>,
	replaceWorkers: boolean,
	execute: PgBossRunner,
	schema = "pgboss",
	startWorkers = true,
	graceful = true,
) {
	const scope = yield* Effect.scope;
	yield* Effect.try({ catch: (error) => toPgBossError("register", error), try: () => registrationNames(registrations) });
	yield* prepareQueues(client, registrations, replaceWorkers);
	if (!startWorkers) {
		return;
	}
	const provided = workerContext(context);
	for (const registration of registrations) {
		if (isQueueWorker(registration) || isQueueDefinition(registration)) {
			yield* registerQueue(client, registration, provided, scope, schema, execute, graceful);
		} else if (isScheduledWorker(registration)) {
			yield* registerSchedule(client, registration, provided, scope, schema, execute, graceful);
		}
	}
});
