import { Effect, Option, Scope } from "effect";
import { WorkerRelease } from "@shivaedev/sql/worker-release/service.ts";
import { registerJobs, registrationName } from "#server/adapters/register.ts";
import { retireJobs } from "#server/adapters/retireJobs.ts";
import type { PgBossClient } from "#server/client.ts";
import type { StopOptions } from "#server/clientOptions.ts";
import type { JobRegistration } from "#server/definition.ts";
import { toPgBossError } from "#server/error.ts";
import type { PgBoss } from "#server/PgBoss.ts";

export const registerReleasedJobs = Effect.fnUntraced(function* <R>(
	client: PgBossClient,
	jobs: readonly JobRegistration<R>[],
	replaceWorkers: boolean,
	schema: string | undefined,
	stop: StopOptions | undefined,
	retired: readonly string[] = [],
) {
	const context = yield* Effect.context<R | PgBoss>();
	const signal = yield* Effect.serviceOption(WorkerRelease);
	const workers = jobs.filter((job) => job._tag !== "QueueDefinition");
	const scope = yield* Effect.scope;
	const register = retireJobs(client, jobs, retired).pipe(
		Effect.andThen(registerJobs(client, jobs, replaceWorkers, schema, true, stop)),
		Effect.provideService(Scope.Scope, scope),
	);
	if (Option.isNone(signal) || (workers.length === 0 && retired.length === 0)) {
		return yield* register;
	}
	yield* registerJobs(client, jobs, replaceWorkers, schema, false, stop);
	let working = replaceWorkers;
	let paused = false;
	yield* signal.value.register((active) =>
		Effect.gen(function* () {
			if (active) {
				yield* register;
				working = true;
				if (paused) {
					yield* Effect.logInfo("Workers resumed for database release");
				}
			} else if (working) {
				yield* Effect.tryPromise({
					catch: (error) => toPgBossError("register", error),
					try: () => Promise.all(workers.map((job) => client.offWork(registrationName(job)))),
				});
				working = false;
				paused = true;
				yield* Effect.logInfo("Workers paused for another database release");
			}
		}).pipe(Effect.provide(context)),
	);
});
