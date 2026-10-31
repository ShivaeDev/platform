import { Effect } from "effect";
import { startContainer } from "#localContainer.ts";
import { docker } from "#localDocker.ts";
import { assertLocalDatabase } from "#localPostgres.ts";
import { PostgresCommandError } from "#PostgresCommandError.ts";
import { type Credentials, connectionAs, passwordsShownIn, ROLE_PASSWORD } from "#test/credentials.ts";
import { databaseUrl, type PostgresEngine, SERVER, usingCli } from "#test/postgresEngine.ts";
import { attempt, recorded } from "#test/setupOutcome.ts";

const READS = new Set(["container", "context", "exec", "info", "inspect", "ps"]);

function present<TValue>(value: TValue | undefined, missing: string) {
	return value === undefined ? Effect.die(new Error(missing)) : Effect.succeed(value);
}

function dockerCalls(engine: PostgresEngine) {
	return engine.calls.filter(([file, command]) => file === "docker" && command !== "context");
}

export function shown(call: readonly string[]) {
	return call.join(" ");
}

function commandOf(failure: unknown) {
	return failure instanceof PostgresCommandError ? `the failed ${failure.command} command` : "no command error";
}

function readinessChecks(engine: PostgresEngine) {
	const started = engine.calls.findLastIndex(([file, command]) => file === "docker" && (command === "start" || command === "run"));
	return started < 0
		? Effect.die(new Error("The container never started"))
		: Effect.succeed(engine.calls.slice(started).filter(([file, ...args]) => file === "psql" && args.includes("SHOW server_version")).length);
}

export function postgresVerbs(engine: PostgresEngine, story: { readonly tell: (line: string) => void }) {
	engine.tell = story.tell;
	function act<E, R>(line: string, run: Effect.Effect<string, E, R>) {
		return Effect.gen(function* () {
			story.tell(line);
			const { failure, outcome } = yield* attempt(usingCli(engine, run));
			engine.failure = failure;
			engine.outcome = engine.queryRole === undefined ? outcome : outcome.replaceAll(engine.queryRole, "the query role");
		});
	}

	function appDatabase() {
		return present(engine.appDatabase, "Declare an app database trait first");
	}
	function asQueryRole(line: string, credentials: Credentials, query: string) {
		return Effect.andThen(present(engine.queryRole, "Declare queryRole() first"), (role) =>
			act(line, engine.manager.sql(connectionAs(SERVER, role, credentials), query)),
		);
	}
	return {
		allowDatabase: (url: string, names: readonly string[]) =>
			act(
				`the setup script checks ${url} against its allowlist ${names.join(", ")}`,
				Effect.map(assertLocalDatabase(url, names), (validated) => `allowed ${validated.pathname.slice(1)}`),
			),
		appDatabase: () =>
			Effect.flatMap(appDatabase(), (name) =>
				Effect.map(usingCli(engine, engine.manager.sql(SERVER, `SELECT 1 FROM pg_database WHERE datname = '${name}'`)), (value) =>
					value ? "present" : "absent",
				),
			),
		appRows: () =>
			Effect.flatMap(appDatabase(), (name) =>
				Effect.map(usingCli(engine, engine.manager.sql(databaseUrl(name), "SELECT value FROM kept ORDER BY value")), (value) => value.split("\n")),
			),
		checkDocker: () => act("setup checks the Docker daemon", docker(engine.environment, ["info"])),
		connectWith: (credentials: Credentials) =>
			asQueryRole(
				`connect as the query role with ${credentials.name} and ask who is signed in`,
				credentials,
				"SELECT session_user || ' on ' || current_database()",
			),
		containerChanges: () =>
			Effect.sync(() =>
				dockerCalls(engine)
					.filter(([, command]) => !READS.has(command ?? ""))
					.map(shown),
			),
		dockerCommands: () => Effect.sync(() => dockerCalls(engine).map(shown)),
		failedCommand: () => Effect.map(present(engine.failure, "Run an action that fails first"), commandOf),
		failureKind: () =>
			Effect.sync(() =>
				engine.failure instanceof PostgresCommandError && engine.failure._tag === "PostgresCommandError" ? "setup command failed" : "another failure",
			),
		inspectedContexts: () =>
			Effect.sync(() =>
				engine.calls
					.filter(([file, command]) => file === "docker" && command === "context")
					.map(([, , , name]) => (name === "--format" ? "the active context" : (name ?? "none"))),
			),
		outcome: () => recorded(engine.outcome),
		passwordsInFailure: () => Effect.map(present(engine.failure, "Run an action that fails first"), passwordsShownIn),
		prepare: (urls: readonly string[]) => act(`setup prepares ${urls.join(" and ")}`, Effect.as(engine.manager.prepareDatabases(urls), "prepared")),
		prepareAppDatabase: () =>
			Effect.andThen(appDatabase(), (name) =>
				act("setup prepares the app database", Effect.as(engine.manager.prepareDatabases([databaseUrl(name)]), "prepared")),
			),
		prepareAppDatabaseAsQueryRole: () =>
			Effect.gen(function* () {
				const name = yield* appDatabase();
				const role = yield* present(engine.queryRole, "Declare queryRole() first");
				const url = connectionAs(databaseUrl(name), role, { name: "userinfo password", search: "", userinfo: ROLE_PASSWORD });
				yield* act("the query role prepares the app database", Effect.as(engine.manager.prepareDatabases([url.toString()]), "prepared"));
			}),
		query: (query: string, connection = SERVER) => act(`query ${connection}: ${query}`, engine.manager.sql(connection, query)),
		queryWith: (credentials: Credentials, query: string) =>
			asQueryRole(`query as the query role with ${credentials.name}: ${query}`, credentials, query),
		readinessChecks: () => readinessChecks(engine),
		runningVersion: () => usingCli(engine, engine.manager.sql(SERVER, "SHOW server_version")),
		start: (connection?: string) =>
			act(
				`setup starts the local PostgreSQL service${connection === undefined ? "" : ` through ${connection}`}`,
				Effect.as(engine.manager.startPostgres(connection), "started"),
			),
		startContainer: () =>
			act(
				"setup starts the managed Docker container",
				Effect.as(
					startContainer((args, options) => docker(engine.environment, args, options)),
					"started",
				),
			),
		subprocesses: () => Effect.sync(() => engine.calls.map(shown)),
	};
}
