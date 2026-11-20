import { Effect, FileSystem, Path } from "effect";
import { AppPostgresVersionMismatch } from "#server/AppPostgresVersionMismatch.ts";
import { LocalPostgresError } from "#server/LocalPostgresError.ts";
import { PostgresBinaries } from "#server/PostgresBinaries.ts";
import { runCommand } from "#server/runCommand.ts";

export const prepareAppPostgresData = Effect.fn("LocalPostgres.prepareAppPostgresData")(function* (dataDirectory: string) {
	const binaries = yield* PostgresBinaries;
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const version = yield* runCommand(binaries.postgres, ["--version"]);
	const expectedMajor = /\b(?<major>\d+)\./u.exec(version)?.groups?.major;
	if (!expectedMajor) {
		return yield* new LocalPostgresError({ message: `Cannot read PostgreSQL major version from ${version}.` });
	}
	const versionFile = path.join(dataDirectory, "PG_VERSION");
	if (yield* fs.exists(versionFile)) {
		const observedMajor = (yield* fs.readFileString(versionFile)).trim();
		if (observedMajor !== expectedMajor) {
			return yield* new AppPostgresVersionMismatch({ dataDirectory, expectedMajor, observedMajor });
		}
		return;
	}
	yield* fs.makeDirectory(dataDirectory, { recursive: true });
	yield* runCommand(binaries.initdb, [
		"--pgdata",
		dataDirectory,
		"--username",
		"postgres",
		"--auth-local=trust",
		"--auth-host=reject",
		"--encoding=UTF8",
		"--locale=C",
	]);
});
