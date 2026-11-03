import { Deferred, Effect, FileSystem, Path, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { LocalPostgresError } from "#server/LocalPostgresError.ts";
import { PostgresBinaries } from "#server/PostgresBinaries.ts";
import { PostgresCommandError } from "#server/PostgresCommandError.ts";
import { prepareAppPostgresData } from "#server/prepareAppPostgresData.ts";

export interface AppPostgresOptions {
	readonly backupsToKeep?: number;
	readonly dataDirectory: string;
}

export interface AppPostgresInstance {
	readonly backupsToKeep: number;
	readonly connectionUrl: string;
	readonly dataDirectory: string;
	readonly socketDirectory: string;
}

export const appPostgres = Effect.fn("LocalPostgres.appPostgres")(function* ({ dataDirectory, backupsToKeep = 5 }: AppPostgresOptions) {
	if (!Number.isSafeInteger(backupsToKeep) || backupsToKeep < 1) {
		return yield* new LocalPostgresError({ message: "backupsToKeep must be a positive integer." });
	}
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const binaries = yield* PostgresBinaries;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const directory = path.resolve(dataDirectory);
	yield* prepareAppPostgresData(directory);
	const socketDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "app-postgres-" });
	yield* fs.chmod(socketDirectory, 0o700);
	const child = yield* spawner.spawn(
		ChildProcess.make(
			binaries.postgres,
			[
				"-D",
				directory,
				"-h",
				"",
				"-k",
				socketDirectory,
				"-c",
				"unix_socket_permissions=0700",
				"-c",
				"logging_collector=off",
				"-c",
				"log_destination=stderr",
				"-c",
				"lc_messages=C",
			],
			{ env: { "LC_ALL": "C" }, extendEnv: true, killSignal: "SIGINT", stdin: "ignore", stdout: "ignore" },
		),
	);
	const ready = yield* Deferred.make<void>();
	let diagnostics = "";
	yield* child.stderr.pipe(
		Stream.decodeText,
		Stream.splitLines,
		Stream.runForEach((line) => {
			diagnostics = line;
			return line.includes("database system is ready to accept connections") ? Deferred.succeed(ready, undefined) : Effect.void;
		}),
		Effect.forkScoped,
	);
	yield* Effect.raceFirst(
		Deferred.await(ready),
		Effect.flatMap(child.exitCode, (code) =>
			Effect.fail(
				new PostgresCommandError({
					command: binaries.postgres,
					exitCode: Number(code),
					message: diagnostics || "PostgreSQL exited before becoming ready.",
				}),
			),
		),
	).pipe(Effect.timeout("30 seconds"));
	const connection = new URL("postgresql://postgres@localhost/postgres");
	connection.searchParams.set("host", socketDirectory);
	return { backupsToKeep, connectionUrl: connection.toString(), dataDirectory: directory, socketDirectory } satisfies AppPostgresInstance;
});
