import { ConfigProvider, Effect, Fiber, Layer, Queue, Redacted, Schema, Stream } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { collection } from "@shivaedev/changes/keys.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { PostgresListenerError } from "@shivaedev/sql/PostgresListenerError.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { disconnectProxy } from "@shivaedev/test-sql/server/disconnectProxy.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppChanges, appHost } from "#appHost.ts";
import type { DatabaseConfig } from "#databaseLayer.ts";
import { Ping, pingHandlers } from "#test/app-host/ping.ts";

const notes = collection("notes", Schema.Number);

type Source = "fallback" | "environment" | "configuration";
function build(config: DatabaseConfig, env: Record<string, string>) {
	return Layer.build(
		appHost({
			config: { ...config, host: "127.0.0.1", port: 0 },
			group: Ping,
			handlers: pingHandlers,
			migrations: {
				loader: Migrator.fromRecord({ "001_notes": SqlClient.SqlClient.use((sql) => sql`create table notes (id integer primary key)`) }),
			},
			policy: "loopback",
		}).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))),
	);
}

const engine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const proxy = yield* disconnectProxy(Redacted.value(database.url), { dropNotifications: true });
	const hints = yield* Queue.unbounded<LiveHint>();
	let context: Effect.Success<ReturnType<typeof build>> | undefined;
	let starting: Fiber.Fiber<string | { failure: string; setting: string; message: string }> | undefined;
	function services() {
		if (context === undefined) {
			throw new Error("Host has not started");
		}
		return context;
	}
	return {
		boot: Effect.fnUntraced(function* (source: Source, silent: boolean) {
			const applicationUrl = source === "fallback" && !silent ? Redacted.value(database.url) : proxy.url;
			const listenerUrl = silent ? proxy.url : Redacted.value(database.url);
			const env = {
				"DATABASE_URL": applicationUrl,
				...(source === "fallback" ? {} : { "LISTEN_DATABASE_URL": source === "configuration" ? proxy.url : listenerUrl }),
			};
			const config = {
				changes: { channel: "listener_connection_story", heartbeatTimeout: "1 second" as const },
				maxConnections: source === "fallback" ? 2 : 1,
				...(source === "configuration" ? { listenDatabaseUrl: Redacted.make(listenerUrl) } : {}),
			};
			starting = yield* build(config, env).pipe(
				Effect.map((built) => {
					context = built;
					return "listening";
				}),
				Effect.catch((error) =>
					error instanceof PostgresListenerError
						? Effect.succeed({ failure: "listener unavailable", message: error.message, setting: error.connectionSetting })
						: Effect.die(error),
				),
				Effect.forkScoped,
			);
		}),
		heartbeatDeadlinePasses: () => TestClock.adjust("1 second"),
		mutedHeartbeat: () => Effect.promise(() => proxy.dropped),
		nextHint: () => Queue.take(hints),
		startupOutcome: () => {
			if (starting === undefined) {
				throw new Error("Start the host first");
			}
			return Fiber.join(starting);
		},
		subscribe: () =>
			AppChanges.pipe(
				Effect.flatMap((changes) => changes.stream([notes.item(1)]).pipe(Stream.runForEach((hint) => Queue.offer(hints, hint)))),
				Effect.provideContext(services()),
				Effect.forkScoped,
			),
		write: () =>
			SqlClient.SqlClient.use((sql) => sql`insert into notes values (1)`).pipe(
				Effect.andThen(invalidateOnCommit(["notes:1"])),
				transact({ onSqlError: (error) => error }),
				Effect.provideContext(services()),
			),
	};
});

export const listenerConnectionStory = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => engine,
	layer: postgres,
	name: "host listener connection",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (current) => current,
});
