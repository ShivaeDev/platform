import { Context, Effect, Exit, Layer, Logger, References, Scope } from "effect";
import type { Job, JobInsert } from "pg-boss";
import { type ConstructorOptions, PgBoss } from "pg-boss";
import { makeWorkerRelease, WorkerRelease } from "@shivaedev/effect-sql/WorkerRelease.ts";
import type { JobPayloadSchema, JobRegistration, QueueDefinition } from "#definition.ts";
import { makePgBoss, type PgBossLayerOptions } from "#service.ts";
import type { clientEngine } from "#test/clientEngine.ts";
import { dispatch } from "#test/dispatch.ts";
import { constructorOptions } from "#test/fakeClient.ts";
import { waitingVerbs } from "#test/waitingVerbs.ts";

export const Jobs = makePgBoss("@test/PgBossStory");

export function pgBossRuntime(state: ReturnType<typeof clientEngine>, tell: (line: string) => void) {
	const logger = Logger.layer([Logger.make(({ logLevel, message }) => state.logs.push({ logLevel, message }))]);
	function logged<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return effect.pipe(Effect.provide(logger), Effect.provideService(References.MinimumLogLevel, "Debug"));
	}
	function native(options?: ConstructorOptions) {
		return new PgBoss({ ...constructorOptions, connectionString: state.connectionString, ...options });
	}
	function start(client: PgBoss, options?: ConstructorOptions) {
		return logged(Layer.build(Jobs.layer({ ...constructorOptions, ...options, clientFactory: () => client, jobs: [] }))).pipe(Effect.as(client));
	}
	function layer<const T extends readonly JobRegistration[], R = never>(jobs: T, options?: Partial<PgBossLayerOptions<T, R>>) {
		return Jobs.layer({
			...constructorOptions,
			...(state.factory === undefined ? {} : { clientFactory: state.factory }),
			connectionString: state.connectionString,
			jobs,
			...options,
		});
	}
	function boot<const T extends readonly JobRegistration[], R = never>(jobs: T, options?: Partial<PgBossLayerOptions<T, R>>) {
		return Effect.gen(function* () {
			tell(`start the jobs runtime with ${jobs.length} registrations`);
			const parent = yield* Scope.Scope;
			const scope = yield* Scope.fork(parent);
			const context = yield* logged(Layer.build(layer(jobs, options)).pipe(Effect.provideService(Scope.Scope, scope)));
			return {
				jobs: Context.get(context, Jobs),
				stop: logged(Scope.close(scope, Exit.void)),
			};
		});
	}
	function terminateIdle(applicationName: string) {
		return Effect.gen(function* () {
			const sql = state.sql;
			if (sql === undefined) {
				return yield* Effect.die(new Error("Terminating idle connections needs the real PostgreSQL trait"));
			}
			const rows = yield* sql<{ pid: number; terminated: boolean }>`select pid, pg_terminate_backend(pid) as terminated from pg_stat_activity
				where datname = current_database() and application_name = ${applicationName} and state = 'idle'`;
			return rows.filter((row) => row.terminated).map((row) => row.pid);
		});
	}
	return {
		admin: (options?: ConstructorOptions) => start(native(options), options),
		boot,
		client: state.client,
		dispatch: (name: string, jobs: readonly Job<unknown>[]) => dispatch(state.client, name, jobs),
		events: state.events,
		expireClaim: (client: PgBoss, job: Job<unknown>, cause: "expiry" | "heartbeat") =>
			waitingVerbs()
				.until(
					Effect.promise(async () => {
						await client.supervise(job.name);
						return client.getJobById(job.name, job.id);
					}),
					(current) => current?.state === "retry",
					(cause === "expiry" ? job.expireInSeconds : (job.heartbeatSeconds ?? 10)) * 1000 + 5000,
				)
				.pipe(Effect.asVoid),
		layer,
		logs: state.logs,
		native,
		register: <const T extends readonly JobRegistration[]>(jobs: T) => boot(jobs).pipe(Effect.flatMap((runtime) => runtime.stop)),

		seed: <const TPayload extends JobPayloadSchema>(
			queue: QueueDefinition<string, TPayload>,
			rows: readonly JobInsert<TPayload["Encoded"]>[],
			client = native(),
		) =>
			Effect.gen(function* () {
				yield* start(client);
				return yield* Effect.promise(async () => {
					await client.createQueue(queue.name, queue.queueOptions);
					const ids = await client.insert(queue.name, [...rows], { returnId: true });
					if (ids === null) {
						throw new Error(`Seeding ${queue.name} returned no job IDs`);
					}
					return ids;
				});
			}),
		terminateIdle,
		workerRelease: Effect.gen(function* () {
			const gate = yield* makeWorkerRelease();
			yield* gate.setActive(true);
			return {
				boot: <const T extends readonly JobRegistration[]>(jobs: T) => boot(jobs).pipe(Effect.provideService(WorkerRelease, gate.service)),
				close: gate.setActive(false),
				open: gate.setActive(true),
			};
		}),
	};
}
