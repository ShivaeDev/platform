import { expect } from "vitest";
import { generatedApplication } from "#test/applicationFiles.ts";
import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";

const BROUGHT = [
	{ content: 'import { repository } from "@shivaedev/sql/repository.ts";\n\nexport const app = repository;\n', path: "src/app.ts" },
	{ content: 'import { story } from "@shivaedev/test/story.ts";\n\nexport const checked = story;\n', path: "src/app.test.ts" },
];

const UNKNOWN_PACKAGE = { content: 'import { users } from "@shivaedev/admin/users.ts";\n\nexport const listed = users;\n', path: "src/admin.ts" };

const TEST_PIECE_IN_PRODUCTION = {
	content: 'import { story } from "@shivaedev/test/story.ts";\n\nexport const shipped = story;\n',
	path: "src/shipped.ts",
};

biomeStory.it(
	"quality's biome rule accepts an application's import of @shivaedev/sql, which platform brings, and of @shivaedev/test in a test, which test-story brings",
	[presetInstalled(), repositoryHas(...generatedApplication, ...BROUGHT)],
	function* ({ checks, reported }) {
		yield* checks();

		expect(yield* reported("lint/correctness/noUndeclaredDependencies")).toEqual([]);
	},
);

biomeStory.it(
	"quality's biome rule rejects an application's import of a package no entry point brings and of the test-only @shivaedev/test from production code",
	[presetInstalled(), repositoryHas(...generatedApplication, UNKNOWN_PACKAGE, TEST_PIECE_IN_PRODUCTION)],
	function* ({ checks, reported }) {
		yield* checks();

		expect(yield* reported("lint/correctness/noUndeclaredDependencies")).toEqual(["src/admin.ts:1", "src/shipped.ts:1"]);
	},
);
