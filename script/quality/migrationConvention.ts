import { posix } from "node:path";
import { MIGRATIONS_DIRECTORY as QUALITY_DIRECTORY, MIGRATION_FILE_PATTERN as QUALITY_PATTERN } from "@shivaedev/quality/naming/isMigrationFile.ts";
import { defineRule } from "@shivaedev/quality/rule.ts";
import { MIGRATION_FILE_PATTERN, MIGRATIONS_FOLDER } from "@shivaedev/sql/migration.ts";

export const migrationConvention = defineRule({
	check: () =>
		posix.basename(QUALITY_DIRECTORY) === MIGRATIONS_FOLDER
		&& QUALITY_PATTERN.source === MIGRATION_FILE_PATTERN.source
		&& QUALITY_PATTERN.flags === MIGRATION_FILE_PATTERN.flags
			? []
			: [
					{
						file: "packages/quality/src/naming/isMigrationFile.ts",
						message: "Quality's tool-owned migration layout must use sql's exported migrations folder name and filename pattern.",
					},
				],
	description: "Keep Quality's default migration naming convention aligned with sql without a runtime dependency.",
	id: "files/migration-convention",
});
