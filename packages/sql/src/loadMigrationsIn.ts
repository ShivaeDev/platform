import { Effect, Path } from "effect";
import { Migrator } from "effect/sql";
import * as MigratorFileSystem from "effect/sql/MigratorFileSystem";
import { MIGRATIONS_FOLDER } from "#migration.ts";

export function loadMigrationsIn(directory: string) {
	return Effect.flatMap(Path.Path, (path) => {
		const folder = path.join(directory, MIGRATIONS_FOLDER);
		return Effect.mapError(
			MigratorFileSystem.fromFileSystem(folder),
			({ cause, kind }) =>
				new Migrator.MigrationError({
					cause,
					kind,
					message: `Cannot read the migrations folder ${folder}: pass the folder that contains "${MIGRATIONS_FOLDER}"`,
				}),
		);
	});
}
