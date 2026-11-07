import { Clock, Context, Duration, Effect, Layer, Redacted, Schema, Stream } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { collection } from "@shivaedev/changes/keys.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appDatabase, type DatabaseConfig } from "#appDatabase.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { type Feed, followHints } from "#test/rpc/followHints.ts";

interface State {
	config: DatabaseConfig;
	context?: Context.Context<SqlClient.SqlClient | Context.Service.Identifier<typeof LiveServer>>;
	feed?: Feed;
}

const notes = collection("notes", Schema.Number);
const APPLICATION_NAME = "pool_lifetime";

function services(state: State) {
	if (state.context === undefined) {
		throw new Error("Start the database first");
	}
	return state.context;
}

export const poolLifetime = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (state: State) {
			const database = yield* PostgresTestDatabase;
			const clock = yield* Clock.Clock;
			state.context = yield* Layer.build(
				appDatabase({
					config: { applicationName: APPLICATION_NAME, databaseUrl: database.url, ...state.config, clock },
					migrations: {
						loader: Migrator.fromRecord({ "001_notes": SqlClient.SqlClient.use((sql) => sql`create table notes (id integer primary key)`) }),
					},
					postgresSettings: {},
				}),
			);
		}),
	},
	around: withIsolatedDatabase,
	clock: "test",
	create: () => Effect.sync((): State => ({ config: { changes: { heartbeatInterval: "1 hour" }, maxConnections: 2 } })),
	inspect: (state) => ({ config: state.config }),
	layer: postgres,
	name: "application connection recycling",
	runIf: databaseUrl !== undefined,
	stages: ["configured"],
	verbs: (state, story) => {
		function backendRows() {
			return SqlClient.SqlClient.use((sql) => sql<{ readonly pid: number }>`select pg_backend_pid() as pid`).pipe(
				Effect.provideContext(services(state)),
			);
		}
		function listeners() {
			return SqlClient.SqlClient.use(
				(sql) =>
					sql<{
						readonly pid: number;
						readonly query: string;
					}>`select pid, query from pg_stat_activity where datname = current_database() and application_name = ${APPLICATION_NAME}`,
			);
		}
		return {
			backend: () => Effect.map(backendRows(), (rows) => rows[0]?.pid),
			backendIsConnected: (pid: number | undefined) =>
				SqlClient.SqlClient.use((sql) => sql`select pid from pg_stat_activity where pid = ${pid}`).pipe(Effect.map((rows) => rows.length > 0)),
			idleTimeoutPasses: () => {
				story.tell("the configured idle timeout passes without an application query");
				return TestClock.adjust(state.config.idleTimeout ?? "1 minute");
			},
			lifetimePasses: (count = 1) => {
				story.tell(`${count} application connection lifetimes pass`);
				return TestClock.adjust(Duration.times(Duration.fromInputUnsafe(state.config.connectionTTL ?? "10 minutes"), count));
			},
			listenerBackend: () => Effect.map(listeners(), (rows) => rows.find((row) => row.query.startsWith("LISTEN "))?.pid),
			nextHint: () => (state.feed === undefined ? Effect.die("Subscribe first") : state.feed.next),
			noteIsWritten: (id: number) =>
				SqlClient.SqlClient.use((sql) => sql`insert into notes values (${id})`).pipe(
					Effect.andThen(invalidateOnCommit([notes.item(id)])),
					transact({ onSqlError: (error) => error }),
					Effect.provideContext(services(state)),
				),
			subscribe: () =>
				Effect.gen(function* () {
					const hints = Context.get(services(state), LiveServer);
					state.feed = yield* followHints(Stream.unwrap(hints.stream([notes.item(1), notes.item(2)])));
				}),
			untilBackendCloses: (pid: number | undefined) =>
				observeUntil(
					SqlClient.SqlClient.use((sql) => sql`select pid from pg_stat_activity where pid = ${pid}`),
					(rows) => rows.length === 0,
					"the idle backend to disconnect",
				),
		};
	},
});

export const staysIdle = poolLifetime.trait("configured", "heartbeats leave the query connection idle for a minute", (state) => {
	state.config = { ...state.config, changes: { heartbeatInterval: "5 minutes" } };
});

export const staysOpenUntilLifetime = poolLifetime.trait("configured", "idle expiry leaves the connection to its lifetime", (state) => {
	state.config = { ...state.config, idleTimeout: Duration.infinity };
});

export const shortLifetime = poolLifetime.trait("configured", "the app chooses a thirty-second connection lifetime", (state) => {
	state.config = { ...state.config, "connectionTTL": "30 seconds" };
});

export const shortIdle = poolLifetime.trait("configured", "the app chooses a thirty-second idle timeout", (state) => {
	state.config = { ...state.config, idleTimeout: "30 seconds" };
});

export const separateListener = poolLifetime.trait("configured", "LISTEN uses its own database URL", function* (state) {
	const database = yield* PostgresTestDatabase;
	state.config = { ...state.config, listenDatabaseUrl: Redacted.make(Redacted.value(database.url)), maxConnections: 1 };
});
