import { Effect, Path } from "effect";
import { Migrator } from "effect/sql";
import { MIGRATIONS_DIRECTORY } from "#migrationConvention.ts";

export function migrationsFromDirectory(root: string) {
	return Effect.flatMap(Path.Path, (path) => Migrator.fromFileSystem(path.join(root, MIGRATIONS_DIRECTORY)));
}
