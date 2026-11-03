import { Clock, Effect, FileSystem, Path } from "effect";
import { runCommand } from "#server/adapters/runCommand.ts";
import type { AppPostgresInstance } from "#server/appPostgres.ts";
import { PostgresBinaries } from "#server/PostgresBinaries.ts";

export const backupAppPostgres = Effect.fn("LocalPostgres.backupAppPostgres")(function* (instance: AppPostgresInstance) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const binaries = yield* PostgresBinaries;
	const directory = path.join(instance.dataDirectory, "backups");
	yield* fs.makeDirectory(directory, { mode: 0o700, recursive: true });
	const timestamp = yield* Clock.currentTimeMillis;
	const backup = yield* Effect.scoped(
		Effect.gen(function* () {
			const staging = yield* fs.makeTempDirectoryScoped({ directory, prefix: `backup-${timestamp}-` });
			const file = path.join(staging, "dump.partial");
			yield* runCommand(binaries.pgDump, ["--format=custom", "--file", file, "--dbname", instance.connectionUrl]);
			const completed = `${staging}.dump`;
			yield* fs.rename(file, completed);
			return completed;
		}),
	);
	const files = (yield* fs.readDirectory(directory))
		.filter((name) => /^backup-\d+-.+\.dump$/u.test(name))
		.sort()
		.reverse();
	for (const file of files.slice(instance.backupsToKeep)) {
		yield* fs.remove(path.join(directory, file));
	}
	return backup;
});

export function migrateAppPostgres<A, E, R>(instance: AppPostgresInstance, migration: Effect.Effect<A, E, R>) {
	return backupAppPostgres(instance).pipe(Effect.andThen(migration));
}
