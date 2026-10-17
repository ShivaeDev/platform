import { Effect, Logger, type LogLevel } from "effect";
import { SqlClient } from "effect/sql";
import type { Pool } from "pg";
import { vi } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { authDatabase } from "#server/authDatabase.ts";
import { postgres } from "#test-support/postgres.ts";

interface Engine {
	readonly logs: Array<{ readonly level: LogLevel.LogLevel; readonly message: unknown }>;
	pool: Pool | undefined;
}

export const authPool = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: (): Engine => ({ logs: [], pool: undefined }),
	inspect: (engine) => ({ logs: engine.logs.length, poolSize: engine.pool?.totalCount }),
	layer: postgres,
	name: "auth database",
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
			logs: () => engine.logs,
			terminateIdleBackend: Effect.fn("AppStory.terminateIdleBackend")(function* () {
				const pid = yield* backend();
				story.tell(`PostgreSQL terminates the idle auth backend ${pid}`);
				const sql = yield* SqlClient.SqlClient;
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

export function openAuthPool() {
	return authPool.trait("pool", "the Better Auth pool is open", function* (engine) {
		const database = yield* PostgresTestDatabase;
		const logger = Logger.make(({ logLevel, message }) => {
			engine.logs.push({ level: logLevel, message });
		});
		engine.pool = yield* authDatabase(database.url).pipe(Effect.provide(Logger.layer([logger])));
	});
}
