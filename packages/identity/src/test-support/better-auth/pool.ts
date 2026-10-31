import { Deferred, Effect, Logger, type LogLevel, Redacted, References } from "effect";
import { SqlClient } from "effect/sql";
import type { Pool } from "pg";
import { vi } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authDatabase } from "#server/better-auth/mount.ts";

const LOCK = 72_401;

type Transport = "TLS" | "plain" | "refused because the server offers no TLS" | `failed: ${string}`;

interface Engine {
	applicationName: string;
	readonly logs: Array<{ readonly level: LogLevel.LogLevel; readonly message: unknown }>;
	pool: Pool | undefined;
	readonly sql: SqlClient.SqlClient;
	transport?: Transport;
}

function pool(engine: Engine) {
	if (engine.pool === undefined) {
		throw new Error("Auth pool has not opened");
	}
	return engine.pool;
}

const queryBackend = Effect.fn("AuthPoolStory.queryBackend")(function* (engine: Engine) {
	const { rows } = yield* Effect.promise(() => pool(engine).query<{ readonly pid: number }>("select pg_backend_pid() as pid"));
	const [row] = rows;
	if (row === undefined) {
		return yield* Effect.die("PostgreSQL returned no backend pid");
	}
	return row.pid;
});

const waitStates = new Map<string | null, string>([
	["advisory", "waiting on the lock"],
	["ClientRead", "idle"],
]);

const backendStates = Effect.fn("AuthPoolStory.backendStates")(function* (engine: Engine) {
	const rows = yield* engine.sql<{ waitEvent: string | null }>`
		select wait_event as "waitEvent" from pg_stat_activity
		where datname = current_database() and application_name = ${engine.applicationName}`;
	return rows.map(({ waitEvent }) => waitStates.get(waitEvent) ?? `busy: ${waitEvent}`);
});

export const authPool = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () =>
		Effect.gen(function* (): Effect.fn.Return<Engine, never, SqlClient.SqlClient> {
			return { applicationName: `auth_pool_${crypto.randomUUID().replaceAll("-", "")}`, logs: [], pool: undefined, sql: yield* SqlClient.SqlClient };
		}),
	inspect: (engine) => ({ logs: engine.logs.length, poolSize: engine.pool?.totalCount }),
	layer: postgres,
	name: "auth database",
	runIf: databaseUrl !== undefined,
	stages: ["pool", "lock"],
	verbs: (engine, story) => ({
		backends: () => {
			story.tell(`read PostgreSQL's view of the backends named ${engine.applicationName}`);
			return backendStates(engine);
		},
		poolLogs: () => Effect.sync(() => engine.logs.map(({ level, message }) => ({ level, message }))),
		query: () =>
			Effect.gen(function* () {
				story.tell("an auth query runs through the pool");
				const exit = yield* Effect.exit(Effect.tryPromise(() => pool(engine).query("select 1")));
				if (exit._tag === "Failure") {
					const text = String(exit.cause);
					engine.transport = text.includes("The server does not support SSL connections")
						? "refused because the server offers no TLS"
						: `failed: ${text}`;
					return;
				}
				const rows = yield* engine.sql<{ ssl: boolean }>`
					select s.ssl from pg_stat_activity a join pg_stat_ssl s using (pid)
					where a.datname = current_database() and a.application_name = ${engine.applicationName}`;
				if (rows.length === 0) {
					engine.transport = "failed: no named backend";
				} else {
					engine.transport = rows.every(({ ssl }) => ssl) ? "TLS" : "plain";
				}
			}),
		queryTransport: () =>
			Effect.sync(() => {
				if (engine.transport === undefined) {
					throw new Error("No auth query has run");
				}
				return engine.transport;
			}),
		serverOffersTls: () => engine.sql<{ ssl: string }>`show ssl`.pipe(Effect.map(([row]) => row?.ssl === "on")),
		startQueries: (count: number) =>
			Effect.gen(function* () {
				story.tell(`${count} auth queries that need the lock start at once`);
				yield* Effect.all(
					Array.from({ length: count }, () => Effect.promise(() => pool(engine).query(`select pg_advisory_xact_lock(${LOCK})`))),
					{ concurrency: "unbounded" },
				).pipe(Effect.forkChild);
				yield* Effect.promise(() =>
					vi.waitFor(async () => {
						const states = await Effect.runPromise(backendStates(engine));
						const queued = pool(engine).totalCount + pool(engine).waitingCount;
						if (queued < count || states.length !== pool(engine).totalCount || states.some((state) => state !== "waiting on the lock")) {
							throw new Error(`The pool has not queued all ${count} queries behind the lock: ${JSON.stringify(states)}`);
						}
					}),
				);
			}),
		terminateIdleBackend: Effect.fn("AuthPoolStory.terminateIdleBackend")(function* () {
			const pid = yield* queryBackend(engine);
			story.tell(`PostgreSQL terminates the idle auth backend ${pid}`);
			yield* engine.sql`select pg_terminate_backend(${pid})`;
			yield* Effect.promise(() =>
				vi.waitFor(() => {
					if (pool(engine).totalCount > 0) {
						throw new Error(`The auth pool still holds backend ${pid}`);
					}
				}),
			);
		}),
	}),
});

export function openAuthPool(options: { readonly maxBackends?: number; readonly sslmode?: "require" | "unset" } = {}) {
	const limit = options.maxBackends === undefined ? "" : ` with at most ${options.maxBackends} backends`;
	const tls = options.sslmode === undefined ? "" : ` and sslmode ${options.sslmode}`;
	return authPool.trait("pool", `the Better Auth pool is open under its own application name${limit}${tls}`, function* (engine) {
		const database = yield* PostgresTestDatabase;
		const logger = Logger.make(({ logLevel, message }) => {
			engine.logs.push({ level: logLevel, message });
		});
		const url = new URL(Redacted.value(database.url));
		if (options.sslmode !== undefined) {
			url.searchParams.delete("sslmode");
			if (options.sslmode !== "unset") {
				url.searchParams.set("sslmode", options.sslmode);
			}
		}
		engine.pool = yield* authDatabase(Redacted.make(url.toString()), {
			"application_name": engine.applicationName,
			...(options.maxBackends === undefined ? {} : { max: options.maxBackends }),
		}).pipe(Effect.provide(Logger.layer([logger])), Effect.provideService(References.MinimumLogLevel, "Debug"));
	});
}

export const lockHeld = authPool.trait("lock", "another transaction holds the advisory lock the auth queries need", function* (engine) {
	const sql = engine.sql;
	const acquired = yield* Deferred.make<void>();
	yield* sql
		.withTransaction(
			Effect.gen(function* () {
				yield* sql`select pg_advisory_xact_lock(${LOCK})`;
				yield* Deferred.succeed(acquired, undefined);
				yield* Effect.never;
			}),
		)
		.pipe(Effect.forkScoped);
	yield* Deferred.await(acquired);
});
