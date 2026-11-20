import { Effect, Path } from "effect";
import * as MigratorFileSystem from "effect/sql/MigratorFileSystem";
import { MIGRATIONS_FOLDER } from "#migration.ts";

export function migrationsFromDirectory(directory: string) {
	return Effect.flatMap(Path.Path, (path) => MigratorFileSystem.fromFileSystem(path.join(directory, MIGRATIONS_FOLDER)));
}
