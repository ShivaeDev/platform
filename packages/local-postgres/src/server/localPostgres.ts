import { Effect, Schedule } from "effect";
import { clientConnection } from "#clientConnection.ts";
import { LocalPostgresError } from "#LocalPostgresError.ts";
import { ensureConnections } from "#localConnections.ts";
import { sqlInContainer, startContainer } from "#localContainer.ts";
import { type DockerEnvironment, docker } from "#localDocker.ts";
import { PostgresVersionMismatch } from "#PostgresVersionMismatch.ts";
import { type CommandOptions, missingCommand, runCommand } from "#runCommand.ts";

export const LOCAL_SERVER = "postgresql://postgres:postgres@127.0.0.1:55432";

export const assertLocalDatabase = Effect.fn("LocalPostgres.assertLocalDatabase")(function* (value: string, names: readonly string[]) {
	const message = `Use a local database on 127.0.0.1:55432 named ${names.join(" or ")}.`;
	const url = yield* Effect.try({ catch: () => new LocalPostgresError({ message }), try: () => new URL(value) });
	if (
		!(["postgres:", "postgresql:"].includes(url.protocol) && ["localhost", "127.0.0.1"].includes(url.hostname))
		|| url.port !== "55432"
		|| ["host", "hostaddr", "port", "dbname", "service"].some((key) => url.searchParams.has(key))
		|| !names.includes(url.pathname.slice(1))
	) {
		return yield* new LocalPostgresError({ message });
	}
	return url;
});

export interface ReadinessOptions {
	readonly attempts?: number;
	readonly delayMillis?: number;
}

export function localPostgres(environment: DockerEnvironment, { attempts = 30, delayMillis = 1000 }: ReadinessOptions = {}) {
	function localDocker(args: readonly string[], options?: CommandOptions) {
		return docker(environment, args, options);
	}
	const sql = localSql(localDocker);
	const startPostgres = Effect.fn("LocalPostgres.startPostgres")(function* (connection = LOCAL_SERVER) {
		const server = yield* Effect.try({
			catch: () => new LocalPostgresError({ message: "Invalid local database URL." }),
			try: () => new URL(connection),
		});
		server.pathname = "/postgres";
		yield* assertLocalDatabase(server.toString(), ["postgres"]);
		function waitForVersion() {
			return sql(server, "SHOW server_version").pipe(Effect.retry({ schedule: Schedule.spaced(delayMillis), times: attempts - 1 }));
		}
		function confirmVersion(observed: string) {
			return observed === "18.6" ? Effect.void : Effect.fail(new PostgresVersionMismatch({ expectedVersion: "18.6", observedVersion: observed }));
		}
		const version = yield* sql(server, "SHOW server_version").pipe(
			Effect.catchTag("PostgresCommandError", () => Effect.andThen(startContainer(localDocker), waitForVersion)),
		);
		yield* confirmVersion(version);
		yield* ensureConnections(
			localDocker,
			(query) => sql(server, query),
			() => Effect.flatMap(waitForVersion(), confirmVersion),
		);
	});
	const prepareDatabases = Effect.fn("LocalPostgres.prepareDatabases")(function* (values: readonly string[]) {
		const urls: URL[] = [];
		for (const value of values) {
			const parsed = yield* Effect.try({
				catch: () => new LocalPostgresError({ message: "Invalid local database URL." }),
				try: () => new URL(value),
			});
			const name = parsed.pathname.slice(1);
			const url = yield* assertLocalDatabase(value, [name]);
			if (!/^[a-z][a-z0-9_]{0,62}$/u.test(name)) {
				return yield* new LocalPostgresError({ message: "Invalid local database name." });
			}
			urls.push(url);
		}
		yield* startPostgres(values[0]);
		for (const url of urls) {
			const name = url.pathname.slice(1);
			const server = new URL(url);
			server.pathname = "/postgres";
			if (!(yield* sql(server, `SELECT 1 FROM pg_database WHERE datname = '${name}'`))) {
				yield* sql(server, `CREATE DATABASE "${name}"`);
			}
		}
	});
	return { prepareDatabases, sql, startPostgres };
}

function localSql(localDocker: (args: readonly string[], options?: CommandOptions) => ReturnType<typeof docker>) {
	return Effect.fn("LocalPostgres.sql")(function* (value: string | URL, query: string) {
		const parsed = yield* Effect.try({ catch: () => new LocalPostgresError({ message: "Invalid local database URL." }), try: () => new URL(value) });
		const { url, options } = clientConnection(yield* assertLocalDatabase(parsed.toString(), [parsed.pathname.slice(1)]));
		const args = ["-X", "--set", "ON_ERROR_STOP=1", "-At", "-c", query];
		return yield* runCommand("psql", [...args, "--dbname", url.toString()], options).pipe(
			Effect.catchTag("PostgresCommandError", (error) =>
				missingCommand(error) ? sqlInContainer(localDocker, url, args, options) : Effect.fail(error),
			),
		);
	});
}
