import { Context, Effect, Exit, Layer, Logger, References, Scope } from "effect";
import type { Job, JobInsert } from "pg-boss";
import { type ConstructorOptions, PgBoss } from "pg-boss";
import type { JobPayloadSchema, JobRegistration, QueueDefinition } from "#definition.ts";
import { makePgBoss, type PgBossLayerOptions } from "#service.ts";
import type { clientEngine } from "#test/clientEngine.ts";
import { dispatch } from "#test/dispatch.ts";
import { constructorOptions } from "#test/fakeClient.ts";

export const Jobs = makePgBoss("@test/PgBossStory");

export function pgBossRuntime(state: ReturnType<typeof clientEngine>, tell: (line: string) => void) {
	function native(options?: ConstructorOptions) {
		return new PgBoss({ ...constructorOptions, connectionString: state.connectionString, ...options });
	}
	function start(client: PgBoss) {
		return Effect.acquireRelease(
			Effect.promise(async () => {
				await client.start();
				return client;
			}),
			(started) => Effect.promise(() => started.stop()),
		);
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
			const logger = Logger.layer([Logger.make(({ logLevel, message }) => state.logs.push({ logLevel, message }))]);
			const parent = yield* Scope.Scope;
			const scope = yield* Scope.fork(parent);
			const context = yield* Layer.build(layer(jobs, options)).pipe(
				Effect.provideService(Scope.Scope, scope),
				Effect.provide(logger),
				Effect.provideService(References.MinimumLogLevel, "Debug"),
			);
			return {
				jobs: Context.get(context, Jobs),
				stop: Scope.close(scope, Exit.void).pipe(Effect.provide(logger), Effect.provideService(References.MinimumLogLevel, "Debug")),
			};
		});
	}
	return {
		admin: (options?: ConstructorOptions) => start(native(options)),
		boot,
		client: state.client,
		dispatch: (name: string, jobs: readonly Job<unknown>[]) => dispatch(state.client, name, jobs),
		events: state.events,
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
	};
}
