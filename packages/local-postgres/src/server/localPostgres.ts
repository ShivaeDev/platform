import { Effect, Schedule } from "effect";
import { assertLocalDatabase } from "#server/assertLocalDatabase.ts";
import { docker } from "#server/docker.ts";
import type { DockerEnvironment } from "#server/dockerEnvironment.ts";
import { ensureConnections } from "#server/ensureConnections.ts";
import { LocalPostgresError } from "#server/LocalPostgresError.ts";
import { startContainer } from "#server/localContainer.ts";
import { localSql } from "#server/localSql.ts";
import { PostgresVersionMismatch } from "#server/PostgresVersionMismatch.ts";
import type { CommandOptions } from "#server/runCommand.ts";

export const LOCAL_SERVER = "postgresql://postgres:postgres@127.0.0.1:55432";

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
		yield* Effect.fromResult(assertLocalDatabase(server.toString(), ["postgres"]));
		function waitForVersion() {
			return sql(server, "SHOW server_version").pipe(Effect.retry({ schedule: Schedule.spaced(delayMillis), times: attempts - 1 }));
		}
		function confirmVersion(observed: string) {
			return /^18\.6(?:\s|$)/u.test(observed)
				? Effect.void
				: Effect.fail(new PostgresVersionMismatch({ expectedVersion: "18.6", observedVersion: observed }));
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
			const url = yield* Effect.fromResult(assertLocalDatabase(value, [name]));
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
