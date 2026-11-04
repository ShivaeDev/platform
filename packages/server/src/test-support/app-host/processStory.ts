import { Effect, Exit, type Redacted, Result, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hostProcess } from "#testing/hostProcess.ts";

const options = { execArgv: ["--conditions=@shivaedev/source"], module: new URL("./process.ts", import.meta.url) };

interface ProcessHostState {
	databaseUrl?: Redacted.Redacted<string>;
	host?: Effect.Success<ReturnType<typeof hostProcess>>;
	readonly scope: Scope.Closeable;
}

const processOptions = {
	clock: "test" as const,
	*create(): Effect.fn.Return<ProcessHostState> {
		return { scope: yield* Scope.make() };
	},
	name: "host child process",
	stages: [],
	verbs: (state: ProcessHostState, story: { tell: (line: string) => void }) => {
		function running() {
			if (state.host === undefined) {
				throw new Error("Launch the host before reading it");
			}
			return state.host;
		}
		return {
			activeWork: () => Effect.suspend(() => running().activeWork()),
			activeWorkOutcome: () =>
				Effect.suspend(() => running().activeWork()).pipe(Effect.match({ onFailure: (failure) => failure.operation, onSuccess: () => "read" })),
			closeScope: () => {
				story.tell("the story closes the scope that owns the child process");
				return Scope.close(state.scope, Exit.void);
			},
			databaseConnections: () =>
				SqlClient.SqlClient.use(
					(sql) =>
						sql<{
							pid: number;
							state: string;
						}>`select pid, state from pg_stat_activity where application_name = ${`host-process-${running().pid}`} order by pid`,
				),
			disconnectIdlePostgres: () => {
				story.tell("the proxy kills the host's idle PostgreSQL connections");
				return Effect.gen(function* () {
					yield* running().disconnectIdlePostgres();
					const sql = yield* SqlClient.SqlClient;
					yield* observeUntil(
						sql`select pid from pg_stat_activity where application_name = ${`host-process-${running().pid}`}`,
						(rows) => rows.length === 0,
						"the host's disconnected PostgreSQL backends to disappear",
					);
				});
			},
			finalizers: () => Effect.suspend(() => running().finalizers()),
			headers: (path: string) => Effect.suspend(() => running().headers(path)),
			health: () => Effect.suspend(() => running().health()),
			healthConnection: () =>
				Effect.suspend(() => running().health()).pipe(Effect.match({ onFailure: () => "refused", onSuccess: () => "connected" })),
			launch: (mode = "http") => {
				story.tell(`the ${mode} host launches and reports readiness over IPC`);
				return Effect.gen(function* () {
					yield* Effect.addFinalizer(() => Scope.close(state.scope, Exit.void));
					state.host = yield* hostProcess({
						...options,
						args: [mode],
						...(state.databaseUrl === undefined ? {} : { databaseUrl: state.databaseUrl }),
					}).pipe(Effect.provideService(Scope.Scope, state.scope));
				});
			},
			launchFailure: () => {
				story.tell("the child exits without reporting readiness");
				return hostProcess({ ...options, args: ["exit-before-ready"] }).pipe(
					Effect.result,
					Effect.map((result) => (Result.isFailure(result) ? result.failure.operation : "started")),
				);
			},
			shutdown: () => {
				story.tell("the child disposes its background workers and HTTP host, then acknowledges shutdown");
				return TestClock.adjust("60 millis").pipe(Effect.andThen(Effect.suspend(() => running().signal("SIGHUP"))));
			},
			shutdownDuration: () => Effect.suspend(() => running().shutdownDuration()),
			signal: (signal: NodeJS.Signals) => {
				story.tell(`the parent delivers ${signal} and waits for the host's acknowledgement`);
				return Effect.suspend(() => running().signal(signal));
			},
			signalOutcome: (signal: NodeJS.Signals) =>
				Effect.suspend(() => running().signal(signal)).pipe(
					Effect.match({ onFailure: (failure) => `${failure.operation} failed`, onSuccess: () => "acknowledged" }),
				),
		};
	},
};

export const processHost = storyKit(processOptions);
export const postgresProcessHost = storyKit({
	...processOptions,
	around: withIsolatedDatabase,
	*create() {
		const state = yield* processOptions.create();
		state.databaseUrl = (yield* PostgresTestDatabase).url;
		return state;
	},
	layer: postgres,
	runIf: databaseUrl !== undefined,
});
