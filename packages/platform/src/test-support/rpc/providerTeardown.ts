import { Context, Effect, Exit, Fiber, Redacted, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { disconnectGate } from "#test/app-host/disconnectGate.ts";
import { createProvider, signup } from "./harness.ts";
import { databaseUrl, postgres } from "./postgres.ts";

export const providerTeardown = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const scope = yield* Scope.fork(yield* Scope.Scope);
		const services = yield* database.isolated.pipe(Scope.provide(scope));
		const url = Context.get(services, PostgresTestDatabase).url;
		const name = new URL(Redacted.value(url)).pathname.slice(1);
		const gate = yield* Effect.acquireRelease(
			Effect.promise(() => disconnectGate(Redacted.value(url))),
			(resource) => Effect.promise(resource.close),
		).pipe(Scope.provide(scope));
		yield* Effect.addFinalizer(() => Effect.sync(gate.release));
		const provider = yield* createProvider(Redacted.make(gate.url)).pipe(Scope.provide(scope));
		yield* Effect.promise(() => signup(provider, "alice"));
		const pids = yield* Effect.promise(async () => {
			const clients = await Promise.all([provider.database.connect(), provider.database.connect()]);
			try {
				return await Promise.all(clients.map(async (client) => (await client.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]?.pid));
			} finally {
				for (const client of clients) {
					client.release();
				}
			}
		});
		return { database, gate, name, pids, provider, scope };
	},
	inspect: ({ name, pids }) => ({ name, pids }),
	layer: postgres,
	name: "RPC provider teardown",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: ({ database, gate, name, pids, provider, scope }, story) => ({
		backends: Effect.fn("ProviderTeardown.backends")(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ pid: number }>`select pid from pg_stat_activity where ${sql.in("pid", pids)}`;
		}),
		close: (owner: "provider" | "scope") => {
			story.tell(`close the ${owner} while PostgreSQL disconnect acknowledgements are held`);
			return (owner === "provider" ? Effect.promise(provider.close) : Scope.close(scope, Exit.void)).pipe(Effect.forkChild);
		},
		closeDatabase: () => Scope.close(scope, Exit.void),
		databases: Effect.fn("ProviderTeardown.databases")(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql<{ datname: string }>`select datname from pg_database where datname = ${name}`;
		}),
		disconnecting: () => Effect.promise(() => gate.disconnecting),
		releaseDisconnects: () => Effect.sync(gate.release),
		shutdownResult: (fiber: Fiber.Fiber<void>) => Effect.sync(() => fiber.pollUnsafe()),
		waitForDatabaseCleanup: () => database.awaitCleanup,
		waitForShutdown: (fiber: Fiber.Fiber<void>) => Fiber.join(fiber),
	}),
});
