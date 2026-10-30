import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgPool from "@effect/sql-pg/PgPool";
import { Config, Context, Deferred, Effect, Fiber, Layer } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appDatabase, appHost } from "#appHost.ts";
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
	stages: ["configured"],
	verbs: (state, story) => {
		function client() {
			if (!state.sql) {
				throw new Error("The application pool has not started");
			}
			return state.sql;
		}
		return {
			holdConnection: () =>
				Effect.gen(function* () {
					story.tell("hold an application transaction open");
					const release = yield* Deferred.make<void>();
					const acquired = yield* Deferred.make<number>();
					const sql = client();
					const holder = yield* heldTransaction(sql, state, release, acquired).pipe(Effect.forkScoped);
					return yield* Effect.raceFirst(Deferred.await(acquired), Fiber.join(holder).pipe(Effect.andThen(Effect.die("Transaction ended early"))));
				}),
			nativePoolQuery: () =>
				Effect.scoped(
					Effect.gen(function* () {
						story.tell("query through the host's native pool service");
						if (state.pool === undefined) {
							return yield* Effect.die("The application pool has not started");
						}
						const connection = yield* state.pool.reserve;
						return (yield* connection.query("select pg_backend_pid() as pid")).rows;
					}),
				),
			nativeQueryFailure: () => client()`select pg_terminate_backend(pg_backend_pid())`.pipe(Effect.flip),
			query: () => {
				story.tell("query through the application pool");
				return client()<{ pid: number }>`select pg_backend_pid() as pid`;
			},
			releaseConnection: (pid: number) => {
				const release = state.releases.get(pid);
				if (!release) {
					throw new Error(`No held transaction for backend ${pid}`);
				}
				story.tell(`release backend ${pid}`);
				return Deferred.succeed(release, undefined);
			},
			terminate: (pid: number) => {
				story.tell(`terminate idle application backend ${pid}`);
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
