import { Effect, Path } from "effect";
import * as MigratorFileSystem from "effect/sql/MigratorFileSystem";
import { MIGRATIONS_DIRECTORY } from "#migrationConvention.ts";

export function migrationsFromDirectory(root: string) {
	return Effect.flatMap(Path.Path, (path) => MigratorFileSystem.fromFileSystem(path.join(root, MIGRATIONS_DIRECTORY)));
}
