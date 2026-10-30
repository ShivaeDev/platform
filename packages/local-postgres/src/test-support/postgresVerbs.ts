import { Effect } from "effect";
import { startContainer } from "#localContainer.ts";
import { docker } from "#localDocker.ts";
import { assertLocalDatabase } from "#localPostgres.ts";
import { type Credentials, connectionAs, passwordsShownIn } from "#test/credentials.ts";
import { databaseUrl, type PostgresEngine, SERVER } from "#test/postgresEngine.ts";
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

function causeOf(failure: unknown) {
	const cause = failure instanceof Error ? failure.cause : undefined;
	const command = cause instanceof Error ? /^Command failed: (?<command>docker \S+|\S+)/u.exec(cause.message)?.groups?.command : undefined;
	return command === undefined ? `no command error: ${String(cause)}` : `the failed ${command} command`;
}

function readinessChecks(engine: PostgresEngine) {
	const started = engine.calls.findLastIndex(([file, command]) => file === "docker" && (command === "start" || command === "run"));
	return started < 0
		? Effect.die(new Error("The container never started"))
		: Effect.succeed(engine.calls.slice(started).filter(([file, ...args]) => file === "psql" && args.includes("SHOW server_version")).length);
}

export function postgresVerbs(engine: PostgresEngine, story: { readonly tell: (line: string) => void }) {
	engine.tell = story.tell;
	function act(line: string, run: () => string) {
		return Effect.sync(() => {
			story.tell(line);
			const { failure, outcome } = attempt(run);
			engine.failure = failure;
			engine.outcome = engine.queryRole === undefined ? outcome : outcome.replaceAll(engine.queryRole, "the query role");
		});
	}
	function appDatabase() {
		return present(engine.appDatabase, "Declare an app database trait first");
	}
	function asQueryRole(line: string, credentials: Credentials, query: string) {
		return Effect.andThen(present(engine.queryRole, "Declare queryRole() first"), (role) =>
			act(line, () => engine.manager.sql(connectionAs(SERVER, role, credentials), query)),
		);
	}
	return {
		allowDatabase: (url: string, names: readonly string[]) =>
			act(
				`the setup script checks ${url} against its allowlist ${names.join(", ")}`,
				() => `allowed ${assertLocalDatabase(url, names).pathname.slice(1)}`,
			),
		appDatabase: () =>
			Effect.map(appDatabase(), (name) => (engine.manager.sql(SERVER, `SELECT 1 FROM pg_database WHERE datname = '${name}'`) ? "present" : "absent")),
		appRows: () => Effect.map(appDatabase(), (name) => engine.manager.sql(databaseUrl(name), "SELECT value FROM kept ORDER BY value").split("\n")),
		checkDocker: () => act("setup checks the Docker daemon", () => docker(engine.environment, ["info"])),
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
		failureCause: () => Effect.map(present(engine.failure, "Run an action that fails first"), causeOf),
		inspectedContexts: () =>
			Effect.sync(() =>
				engine.calls
					.filter(([file, command]) => file === "docker" && command === "context")
					.map(([, , , name]) => (name === "--format" ? "the active context" : (name ?? "none"))),
			),
		outcome: () => recorded(engine.outcome),
		passwordsInFailure: () => Effect.map(present(engine.failure, "Run an action that fails first"), passwordsShownIn),
		prepare: (urls: readonly string[]) =>
			act(`setup prepares ${urls.join(" and ")}`, () => {
				engine.manager.prepareDatabases(urls);
				return "prepared";
			}),
		prepareAppDatabase: () =>
			Effect.andThen(appDatabase(), (name) =>
				act("setup prepares the app database", () => {
					engine.manager.prepareDatabases([databaseUrl(name)]);
					return "prepared";
				}),
			),
		query: (query: string, connection = SERVER) => act(`query ${connection}: ${query}`, () => engine.manager.sql(connection, query)),
		queryWith: (credentials: Credentials, query: string) =>
			asQueryRole(`query as the query role with ${credentials.name}: ${query}`, credentials, query),
		readinessChecks: () => readinessChecks(engine),
		runningVersion: () => Effect.sync(() => engine.manager.sql(SERVER, "SHOW server_version")),
		start: (connection?: string) =>
			act(`setup starts the local PostgreSQL service${connection === undefined ? "" : ` through ${connection}`}`, () => {
				engine.manager.startPostgres(connection);
				return "started";
			}),
		startContainer: () =>
			act("setup starts the managed Docker container", () => {
				startContainer((args, options) => docker(engine.environment, args, options));
				return "started";
			}),
		subprocesses: () => Effect.sync(() => engine.calls.map(shown)),
	};
}
