import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgPool from "@effect/sql-pg/PgPool";
import { Config, Context, Deferred, Effect, Fiber, Layer, Predicate } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { environmentVariable } from "@shivaedev/identity/test-support/environmentVariable.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appDatabase, appHost } from "#appHost.ts";
import { answered } from "#test/answers.ts";
import { Ping, pingHandlers } from "./ping.ts";

interface PoolState {
	limit: number;
	mode: "database" | "host";
	pool?: PgPool.PgPool;
	releases: Map<number, Deferred.Deferred<void>>;
	sql?: SqlClient.SqlClient;
}

function heldTransaction(sql: SqlClient.SqlClient, state: PoolState, release: Deferred.Deferred<void>, acquired: Deferred.Deferred<number>) {
	return sql.withTransaction(
		Effect.gen(function* () {
			const [row] = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
			if (!row) {
				return yield* Effect.die("PostgreSQL did not return its backend pid");
			}
			state.releases.set(row.pid, release);
			yield* Deferred.succeed(acquired, row.pid);
			yield* Deferred.await(release);
		}),
	);
}

export const pool = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (state: PoolState) {
			const databaseUrl = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
			const config = { databaseUrl, host: "127.0.0.1", maxConnections: state.limit, port: 0 };
			const migrations = { loader: Migrator.fromRecord({}) };
			const database = appDatabase({ config, migrations });
			const layer = state.mode === "database" ? database : appHost({ config, group: Ping, handlers: pingHandlers, migrations, policy: "loopback" });
			const context = yield* Layer.build(layer);
			state.sql = Context.get(context, SqlClient.SqlClient);
			state.pool = Context.get(context, PgPool.PgPool);
		}),
	},
	clock: "live",
	create: () => Effect.sync((): PoolState => ({ limit: 3, mode: "database", releases: new Map() })),
	inspect: (state) => ({ heldBackends: [...state.releases.keys()], limit: state.limit, mode: state.mode }),
	name: "host pool",
	runIf: environmentVariable("PLATFORM_SQL_TEST_DATABASE_URL") !== undefined,
	stages: ["configured"],
	verbs: (state, story) => {
		function client() {
			if (!state.sql) {
				throw new Error("The application pool has not started");
			}
			return state.sql;
		}
		function backendOf(rows: readonly unknown[]) {
			const [row] = rows;
			return Predicate.hasProperty(row, "pid") && typeof row.pid === "number"
				? Effect.succeed(row.pid)
				: Effect.die("PostgreSQL returned no backend");
		}
		function holdConnection() {
			return Effect.gen(function* () {
				const release = yield* Deferred.make<void>();
				const acquired = yield* Deferred.make<number>();
				const holder = yield* heldTransaction(client(), state, release, acquired).pipe(Effect.forkScoped);
				return yield* Effect.raceFirst(Deferred.await(acquired), Fiber.join(holder).pipe(Effect.andThen(Effect.die("Transaction ended early"))));
			});
		}
		return {
			heldConnectionsFillThePool: () => {
				story.tell(`${state.limit - 1} application transactions hold every query connection beside the listener`);
				return Effect.map(Effect.replicateEffect(holdConnection(), state.limit - 1), (pids) => new Set(pids).size);
			},
			nativePoolBackend: () =>
				Effect.scoped(
					Effect.gen(function* () {
						if (state.pool === undefined) {
							return yield* Effect.die("The application pool has not started");
						}
						const connection = yield* state.pool.reserve;
						return yield* backendOf((yield* connection.query("select pg_backend_pid() as pid")).rows);
					}),
				),
			queryBackend: () => Effect.flatMap(client()<{ pid: number }>`select pg_backend_pid() as pid`, backendOf),
			queryWaitsForRelease: () => {
				const [released] = state.releases.keys();
				story.tell(`a query arrives while the pool is full, then backend ${released} is released`);
				return Effect.gen(function* () {
					const queued = yield* Effect.forkChild(Effect.flatMap(client()<{ pid: number }>`select pg_backend_pid() as pid`, backendOf), {
						startImmediately: true,
					});
					const release = released === undefined ? undefined : state.releases.get(released);
					if (release !== undefined) {
						yield* Deferred.succeed(release, undefined);
					}
					const answeredBy = yield* Fiber.join(queued);
					return answeredBy === released ? "answered by the released backend" : `answered by another backend ${answeredBy}`;
				});
			},
			selfTerminatingQuery: () => {
				story.tell("an application query terminates its own backend");
				return answered(client()`select pg_terminate_backend(pg_backend_pid())`);
			},
			theIdleBackendIsTerminated: (pid: number) => {
				story.tell(`an administrator terminates idle application backend ${pid}`);
				return Effect.scoped(
					Effect.gen(function* () {
						const url = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
						yield* Effect.gen(function* () {
							const admin = yield* SqlClient.SqlClient;
							yield* admin`select pg_terminate_backend(${pid}, 5000)`;
						}).pipe(Effect.provide(PgClient.layer({ url })));
						yield* Effect.promise(() => new Promise<void>((resolve) => setImmediate(resolve)));
					}),
				);
			},
		};
	},
});

export function poolCapacity(mode: PoolState["mode"], limit: number) {
	return pool.trait("configured", `${mode} limits its pool to ${limit} connections`, (state) => {
		state.mode = mode;
		state.limit = limit;
	});
}
