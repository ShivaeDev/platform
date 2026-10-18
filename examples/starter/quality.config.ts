import { readdirSync } from "node:fs";
import { MIGRATION_FILE_PATTERN, MIGRATIONS_DIRECTORY } from "@shivaedev/effect-sql/migrationConvention.ts";
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	exceptions: [
		{
			files: readdirSync(new URL(`./${MIGRATIONS_DIRECTORY}/`, import.meta.url))
				.filter((name) => MIGRATION_FILE_PATTERN.test(name))
				.map((name) => `${MIGRATIONS_DIRECTORY}/${name}`),
			reason: "Effect's native Migrator filesystem loader requires each migration to default-export its Effect.",
			rules: ["biome/lint/style/noDefaultExport"],
		},
	],
});
