import { type Context, Effect, Scope } from "effect";
import type { StopOptions } from "pg-boss";
import { registerWorker } from "#adapters/registerWorker.ts";
import { workerDiagnostics } from "#adapters/workerDiagnostics.ts";
import type { PgBossClient } from "#client.ts";
import type { JobPayloadSchema, JobRegistration, QueueDefinition, QueueWorker, ScheduleDefinition, ScheduledWorker } from "#definition.ts";
import { PgBossQueueOptionsError, toPgBossError } from "#error.ts";
import { ensureQueue } from "#internal/ensureQueue.ts";
import { runQueueWorker } from "#internal/runQueueWorker.ts";

function registrationDefinition(registration: JobRegistration): QueueDefinition | ScheduleDefinition {
	if (registration._tag === "QueueDefinition") {
		return registration;
	}
	if (registration._tag === "QueueWorker") {
		return registration.queue;
	}
	return registration.schedule;
}

export function registrationName(registration: JobRegistration): string {
	return registrationDefinition(registration).name;
}

const prepareQueues = Effect.fnUntraced(function* (client: PgBossClient, registrations: readonly JobRegistration[], replaceWorkers: boolean) {
	for (const registration of registrations) {
		if (replaceWorkers && registration._tag !== "QueueDefinition") {
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

const registerQueue = Effect.fnUntraced(function* <R>(
	client: PgBossClient,
	registration: QueueWorker<JobPayloadSchema & { readonly DecodingServices: R }, R> | QueueDefinition,
	context: Context.Context<R>,
	scope: Scope.Scope,
	schema: string,
	stop: StopOptions | undefined,
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
		(job, deadline) => runQueueWorker(registration, job, deadline, client, schema),
		scope,
		schema,
		queue.maxDeferrals,
		stop,
	).pipe(Effect.provide(context));
});

const registerSchedule = Effect.fnUntraced(function* <R>(
	client: PgBossClient,
	worker: ScheduledWorker<R>,
	context: Context.Context<R>,
	scope: Scope.Scope,
	schema: string,
	stop: StopOptions | undefined,
) {
	const { schedule } = worker;
	yield* registerWorker(
		client,
		schedule.name,
		schedule.workerOptions,
		() => workerDiagnostics(worker.effect),
		scope,
		schema,
		schedule.maxDeferrals,
		stop,
	).pipe(Effect.provide(context));
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
	registrations: readonly JobRegistration<R>[],
	context: Context.Context<R>,
	replaceWorkers: boolean,
	schema = "pgboss",
	startWorkers = true,
	stop?: StopOptions,
) {
	const scope = yield* Scope.fork(yield* Effect.scope, "parallel");
	yield* Effect.try({ catch: (error) => toPgBossError("register", error), try: () => registrationNames(registrations) });
	yield* prepareQueues(client, registrations, replaceWorkers);
	if (!startWorkers) {
		return;
	}
	for (const registration of registrations) {
		if (registration._tag === "QueueWorker" || registration._tag === "QueueDefinition") {
			yield* registerQueue(client, registration, context, scope, schema, stop);
		} else {
			yield* registerSchedule(client, registration, context, scope, schema, stop);
		}
	}
});
