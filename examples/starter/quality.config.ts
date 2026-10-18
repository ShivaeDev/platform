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
		{
			files: ["**", "!**/src/client/ui"],
			reason: "components.json assigns src/client/ui to the shadcn CLI. Preserve its stock output; TypeScript still checks it.",
			rules: ["biome/files/includes"],
		},
		{
			files: ["src/client/ui/chart.tsx"],
			reason: "The shadcn CLI owns this stock chart module, including its size.",
			rules: ["structure/max-lines"],
		},
	],
	rules: {
		"files/named-after-export": {
			options: {
				toolOwned: [
					`${MIGRATIONS_DIRECTORY}/`,
					"*.config.*",
					"*.d.ts",
					"*.d.mts",
					"*.d.cts",
					"**/.railway/railway.ts",
					"**/.railway/railway.py",
					"**/.railway/railway.go",
					"src/client/ui/",
				],
			},
		},
	},
});
