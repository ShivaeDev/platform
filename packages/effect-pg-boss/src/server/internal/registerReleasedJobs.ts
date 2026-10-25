import { type Context, Effect, Option, Scope } from "effect";
import { WorkerRelease } from "@shivaedev/effect-sql/WorkerRelease.ts";
import type { PgBossClient } from "#client.ts";
import type { JobRegistration } from "#definition.ts";
import { toPgBossError } from "#error.ts";
import { registerJobs, registrationName } from "./register.ts";

export const registerReleasedJobs = Effect.fn("PgBoss.registerReleasedJobs")(function* <R>(
	client: PgBossClient,
	jobs: readonly JobRegistration[],
	context: Context.Context<R>,
	replaceWorkers: boolean,
	schema?: string,
) {
	const signal = yield* Effect.serviceOption(WorkerRelease);
	const workers = jobs.filter((job) => job._tag !== "QueueDefinition");
	const scope = yield* Effect.scope;
	const register = registerJobs(client, jobs, context, replaceWorkers, schema).pipe(Effect.provideService(Scope.Scope, scope));
	if (Option.isNone(signal) || workers.length === 0) {
		return yield* register;
	}
	yield* registerJobs(client, jobs, context, replaceWorkers, schema, false);
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
