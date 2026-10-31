import { MIGRATIONS_DIRECTORY as QUALITY_DIRECTORY, MIGRATION_FILE_PATTERN as QUALITY_PATTERN } from "@shivaedev/quality/naming/migrationFile.ts";
import { defineRule } from "@shivaedev/quality/rule.ts";
import { MIGRATION_FILE_PATTERN, MIGRATIONS_DIRECTORY } from "@shivaedev/sql/migrationConvention.ts";

export const migrationConvention = defineRule({
	check: async () =>
		QUALITY_DIRECTORY === MIGRATIONS_DIRECTORY
		&& QUALITY_PATTERN.source === MIGRATION_FILE_PATTERN.source
		&& QUALITY_PATTERN.flags === MIGRATION_FILE_PATTERN.flags
			? []
			: [
					{
						file: "packages/quality/src/naming/migrationFile.ts",
						message: "Quality's tool-owned migration layout must match sql's exported migration directory and filename pattern.",
					},
				],
	description: "Keep Quality's default migration naming convention aligned with sql without a runtime dependency.",
	id: "files/migration-convention",
});
