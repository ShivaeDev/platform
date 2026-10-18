import { Context, Effect, Exit, Layer, Logger, References, Scope } from "effect";
import type { Job } from "pg-boss";
import { type ConstructorOptions, PgBoss } from "pg-boss";
import type { JobRegistration } from "#definition.ts";
import { makePgBoss, type PgBossLayerOptions } from "#service.ts";
import type { clientEngine } from "#test/clientEngine.ts";
import { dispatch } from "#test/dispatch.ts";
import { constructorOptions } from "#test/fakeClient.ts";

export const Jobs = makePgBoss("@test/PgBossStory");

export function pgBossRuntime(state: ReturnType<typeof clientEngine>, tell: (line: string) => void) {
	function layer<const T extends readonly JobRegistration[], R = never>(jobs: T, options?: Partial<PgBossLayerOptions<T, R>>) {
		return Jobs.layer({ ...constructorOptions, clientFactory: state.factory, connectionString: state.connectionString, jobs, ...options });
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
		admin: (options?: ConstructorOptions) =>
			Effect.acquireRelease(
				Effect.promise(async () => {
					const client = new PgBoss({ ...constructorOptions, connectionString: state.connectionString, ...options });
					await client.start();
					return client;
				}),
				(client) => Effect.promise(() => client.stop()),
			),
		boot,
		client: state.client,
		dispatch: (name: string, jobs: readonly Job<unknown>[]) => dispatch(state.client, name, jobs),
		events: state.events,
		layer,
		logs: state.logs,
		native: (options?: ConstructorOptions) => new PgBoss({ ...constructorOptions, connectionString: state.connectionString, ...options }),
		register: <const T extends readonly JobRegistration[]>(jobs: T) => boot(jobs).pipe(Effect.flatMap((runtime) => runtime.stop)),
	};
}
