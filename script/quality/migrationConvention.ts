import { MIGRATION_FILE_PATTERN, MIGRATIONS_DIRECTORY } from "@shivaedev/effect-sql/migrationConvention.ts";
import { defineRule } from "@shivaedev/quality/rule.ts";
import { MIGRATIONS_DIRECTORY as QUALITY_DIRECTORY, MIGRATION_FILE_PATTERN as QUALITY_PATTERN } from "#quality-internal/naming/migrationFile.ts";

export const migrationConvention = defineRule({
	check: async () =>
		QUALITY_DIRECTORY === MIGRATIONS_DIRECTORY
		&& QUALITY_PATTERN.source === MIGRATION_FILE_PATTERN.source
		&& QUALITY_PATTERN.flags === MIGRATION_FILE_PATTERN.flags
			? []
			: [
					{
						file: "packages/quality/src/naming/migrationFile.ts",
						message: "Quality's tool-owned migration layout must match effect-sql's exported migration directory and filename pattern.",
					},
				],
	description: "Keep Quality's default migration naming convention aligned with effect-sql without a runtime dependency.",
	id: "files/migration-convention",
});
