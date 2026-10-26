import { Deferred, Effect, Fiber, Logger, type LogLevel, Redacted, References } from "effect";
import { SqlClient } from "effect/sql";
import type { Pool, PoolConfig } from "pg";
import { vi } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authDatabase } from "#server/better-auth/mount.ts";
import { databaseUrl, postgres } from "./postgres.ts";

interface Engine {
	readonly logs: Array<{ readonly level: LogLevel.LogLevel; readonly message: unknown }>;
	pool: Pool | undefined;
	readonly sql: SqlClient.SqlClient;
}

export const authPool = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () =>
		Effect.gen(function* (): Effect.fn.Return<Engine, never, SqlClient.SqlClient> {
			return { logs: [], pool: undefined, sql: yield* SqlClient.SqlClient };
		}),
	inspect: (engine) => ({ logs: engine.logs.length, poolSize: engine.pool?.totalCount }),
	layer: postgres,
	name: "auth database",
	runIf: databaseUrl !== undefined,
	stages: ["pool"],
	verbs: (engine, story) => {
		function pool() {
			if (engine.pool === undefined) {
				throw new Error("Auth pool has not opened");
			}
			return engine.pool;
		}
		const backend = Effect.fn("AppStory.backend")(function* () {
			const { rows } = yield* Effect.promise(() => pool().query<{ readonly pid: number }>("select pg_backend_pid() as pid"));
			const [row] = rows;
			if (row === undefined) {
				return yield* Effect.die("PostgreSQL returned no backend pid");
			}
			return row.pid;
		});
		return {
			backend,
			backends: Effect.fn("AuthPoolStory.backends")(function* (name: string) {
				const sql = engine.sql;
				return yield* sql<{ applicationName: string; waitEvent: string | null }>`
					select application_name as "applicationName", wait_event as "waitEvent" from pg_stat_activity
					where datname = current_database() and application_name = ${name}`;
			}),
			blockQueries: Effect.fn("AuthPoolStory.blockQueries")(function* () {
				story.tell("PostgreSQL blocks the auth queries on an advisory lock");
				const sql = engine.sql;
				const acquired = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const holder = yield* sql
					.withTransaction(
						Effect.gen(function* () {
							yield* sql`select pg_advisory_xact_lock(72401)`;
							yield* Deferred.succeed(acquired, undefined);
							yield* Deferred.await(release);
						}),
					)
					.pipe(Effect.forkScoped);
				yield* Deferred.await(acquired);
				return Deferred.succeed(release, undefined).pipe(Effect.andThen(Fiber.join(holder)));
			}),
			connectionBackends: (name: string) => engine.sql<{ ssl: boolean }>`
				select s.ssl from pg_stat_activity a join pg_stat_ssl s using (pid)
				where a.datname = current_database() and a.application_name = ${name}`,
			logs: () => engine.logs,
			outstandingQueries: () => pool().totalCount + pool().waitingCount,
			query: () => {
				story.tell("query through the auth pool");
				return Effect.tryPromise(() => pool().query("select pg_advisory_xact_lock(72401)"));
			},
			serverTls: () => engine.sql<{ ssl: string }>`show ssl`.pipe(Effect.map(([row]) => row?.ssl === "on")),
			terminateIdleBackend: Effect.fn("AppStory.terminateIdleBackend")(function* () {
				const pid = yield* backend();
				story.tell(`PostgreSQL terminates the idle auth backend ${pid}`);
				const sql = engine.sql;
				yield* sql`select pg_terminate_backend(${pid})`;
				yield* Effect.promise(() =>
					vi.waitFor(() => {
						if (pool().totalCount > 0) {
							throw new Error(`The auth pool still holds backend ${pid}`);
						}
					}),
				);
				return pid;
			}),
		};
	},
});

export function openAuthPool(options?: Pick<PoolConfig, "max" | "application_name">, mode?: "require" | "unset") {
	return authPool.trait("pool", "the Better Auth pool is open", function* (engine) {
		const database = yield* PostgresTestDatabase;
		const logger = Logger.make(({ logLevel, message }) => {
			engine.logs.push({ level: logLevel, message });
		});
		const url = new URL(Redacted.value(database.url));
		if (mode !== undefined) {
			url.searchParams.delete("sslmode");
			if (mode !== "unset") {
				url.searchParams.set("sslmode", mode);
			}
		}
		engine.pool = yield* authDatabase(Redacted.make(url.toString()), options).pipe(
			Effect.provide(Logger.layer([logger])),
			Effect.provideService(References.MinimumLogLevel, "Debug"),
		);
	});
}
