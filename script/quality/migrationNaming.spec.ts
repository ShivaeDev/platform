import { afterEach, expect } from "vitest";
import { migrationFiles, namingFiles } from "#quality/test-support/migrationFiles.ts";
import { removeSeededTrees } from "#quality-fixtures/tree.ts";

afterEach(removeSeededTrees);

const SOURCE = "export function applySchema(): number { return 1; }\n";

migrationFiles.it(
	"accepts numbered migrations in root and nested apps without configuration",
	[
		namingFiles([
			{ content: SOURCE, path: "src/server/migrations/0001_create_notes.ts" },
			{ content: SOURCE, path: "apps/web/src/server/migrations/0020_add_labels.ts" },
			{ content: SOURCE, path: "src/modules/labels/server/migrations/0002_create_labels.ts" },
		]),
	],
	function* ({ checkNames, violations }) {
		yield* checkNames();
		expect(violations()).toEqual([]);
	},
);

migrationFiles.it(
	"still reports authored files and folders beside migrations and outside the convention",
	[
		namingFiles([
			{ content: SOURCE, path: "src/server/migrations/0001_create_notes.ts" },
			{ content: SOURCE, path: "src/server/migrations/0002-create-labels.ts" },
			{ content: SOURCE, path: "src/server/migrations/00003_create_labels.ts" },
			{ content: SOURCE, path: "src/server/migrations/0004_Create_labels.ts" },
			{ content: SOURCE, path: "src/server/migrations/helpers/0005_add_labels.ts" },
			{ content: SOURCE, path: "src/migrations/0006_add_labels.ts" },
			{ content: SOURCE, path: "src/server/migrationsExtra/0007_add_labels.ts" },
			{ content: SOURCE, path: "src/server/migrations/WrongFolder/applySchema.ts" },
			{ content: "{}", path: "src/server/migrations/WrongName.json" },
		]),
	],
	function* ({ checkNames, violations }) {
		yield* checkNames();
		expect(violations()).toEqual([
			{ file: "src/migrations/0006_add_labels.ts", rule: "files/named-after-export" },
			{ file: "src/server/migrations/00003_create_labels.ts", rule: "files/named-after-export" },
			{ file: "src/server/migrations/0002-create-labels.ts", rule: "files/named-after-export" },
			{ file: "src/server/migrations/0004_Create_labels.ts", rule: "files/named-after-export" },
			{ file: "src/server/migrations/helpers/0005_add_labels.ts", rule: "files/named-after-export" },
			{ file: "src/server/migrationsExtra/0007_add_labels.ts", rule: "files/named-after-export" },
			{ file: "src/server/migrations/WrongFolder", rule: "files/folder-names" },
			{ file: "src/server/migrationsExtra", rule: "files/folder-names" },
			{ file: "src/server/migrations/WrongName.json", rule: "files/other-names" },
		]);
	},
);
