import { afterEach, expect } from "vitest";
import { migrationFiles, presetFiles } from "#quality/test-support/migrationFiles.ts";
import { removeSeededTrees } from "#quality-fixtures/tree.ts";

afterEach(removeSeededTrees);

const MIGRATION = 'import { Effect } from "effect";\n\nexport default Effect.void;\n';

migrationFiles.it(
	"lets numbered migrations default-export their Effect while every other file still may not",
	[
		presetFiles([
			{ content: MIGRATION, path: "src/server/migrations/0001_create_notes.ts" },
			{ content: MIGRATION, path: "apps/web/src/server/migrations/0020_add_labels.ts" },
			{ content: MIGRATION, path: "src/server/migrations/0002-create-labels.ts" },
			{ content: MIGRATION, path: "src/server/migrations/00003_create_labels.ts" },
			{ content: MIGRATION, path: "src/server/migrations/helpers/0005_add_labels.ts" },
			{ content: MIGRATION, path: "src/server/migrations/applySchema.ts" },
			{ content: MIGRATION, path: "src/migrations/0006_add_labels.ts" },
			{ content: MIGRATION, path: "src/notes.ts" },
		]),
	],
	function* ({ defaultExports, lintDefaultExports }) {
		yield* lintDefaultExports();
		expect(defaultExports()).toEqual([
			"src/migrations/0006_add_labels.ts",
			"src/notes.ts",
			"src/server/migrations/00003_create_labels.ts",
			"src/server/migrations/0002-create-labels.ts",
			"src/server/migrations/applySchema.ts",
			"src/server/migrations/helpers/0005_add_labels.ts",
		]);
	},
);
