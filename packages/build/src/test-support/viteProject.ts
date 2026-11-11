import { fileURLToPath } from "node:url";

// The browser side of the notes project, as an application writes it, and the variants that reach server code instead.

const NOTES_PAGE: Readonly<Record<string, string>> = {
	"index.html": `<!doctype html>
<html>
	<body>
		<script type="module" src="/src/client.ts"></script>
	</body>
</html>
`,
	"src/client.ts": `import { Notes } from "#generated/modules/notes/notes.ts";

console.log(Notes);
`,
};

const SCREEN_IMPORTING_THE_MODULE: Readonly<Record<string, string>> = {
	"src/client.ts": `import { notesScreen } from "#screens/notes.ts";

console.log(notesScreen);
`,
	"src/screens/notes.ts": `import { Notes } from "#modules/notes/notes.ts";

export const notesScreen = { module: Notes };
`,
};

const PAGE_IMPORTING_THE_TAGS_CLIENT: Readonly<Record<string, string>> = {
	"src/client.ts": `import { Notes } from "#generated/modules/notes/notes.ts";
import { Tags } from "#generated/modules/tags/tags.ts";

console.log(Notes, Tags);
`,
};

const TAGS_MODULE = {
	path: "src/modules/tags/tags.ts",
	text: `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { tagsWire } from "#generated/modules/tags/tags.ts";

const Names = query("names", {
	*run() {
		return ["inbox", "later"];
	},
});

export const Tags = defineModule({ name: "tags", operations: [Names], requires: [], wire: tagsWire });
`,
};

const SERVER_CODE_PAGES = {
	"a file under a server folder": {
		"src/client.ts": `import { sessionCookie } from "#server/session.ts";

console.log(sessionCookie);
`,
		"src/server/session.ts": `export const sessionCookie = "session";
`,
	},
	"a Node builtin": {
		"src/client.ts": `import { readFileSync } from "node:fs";

console.log(readFileSync);
`,
	},
	"a package listed as server-only": {
		"node_modules/fixture-queue/index.js": `export const queue = "jobs";
`,
		"node_modules/fixture-queue/package.json": `{ "name": "fixture-queue", "type": "module", "exports": "./index.js" }
`,
		"src/client.ts": `import { queue } from "fixture-queue";

console.log(queue);
`,
	},
	"an operation file": {
		"src/client.ts": `import { List } from "#modules/notes/list.ts";

console.log(List);
`,
	},
	"effect at its entry and, four imports deeper, a repository on effect/sql/SqlClient": {
		"src/client.ts": `import { Schema } from "effect";
import { notesScreen } from "#screens/notes.ts";

console.log(Schema.String, notesScreen);
`,
		"src/data/notes.ts": `import { notesRepository } from "#data/repository.ts";

export const notesData = { repository: notesRepository };
`,
		"src/data/repository.ts": `import { SqlClient } from "effect/sql/SqlClient";

export const notesRepository = { client: SqlClient };
`,
		"src/screens/list.ts": `import { notesData } from "#data/notes.ts";

export const listScreen = { data: notesData };
`,
		"src/screens/notes.ts": `import { listScreen } from "#screens/list.ts";

export const notesScreen = { list: listScreen };
`,
	},
	"effect/sql": {
		"src/client.ts": `import { SqlClient } from "effect/sql";

console.log(SqlClient);
`,
	},
} satisfies Record<string, Readonly<Record<string, string>>>;

const CONDITIONS = JSON.stringify(["@shivaedev/source", "node", "development|production"]);

const NOTES_TEST_FILE = `import { expect, test } from "vitest";
import { notesWire } from "#generated/modules/notes/notes.ts";

test("the generated notes wire lists the module's operations", () => {
	expect(Object.keys(notesWire)).toContain("list");
});
`;

// The global setup runs from this package's sources, which Vitest's own environment resolves only with the source condition.
const NOTES_TEST: Readonly<Record<string, string>> = {
	"src/notes.test.ts": NOTES_TEST_FILE,
	"vitest.config.mjs": `export default {
	environments: { __vitest__: { resolve: { conditions: ${CONDITIONS} } } },
	ssr: { resolve: { conditions: ${CONDITIONS} } },
	test: { globalSetup: [${JSON.stringify(fileURLToPath(new URL("../adapters/vitest/setup.ts", import.meta.url)))}], include: ["src/**/*.test.ts"] },
};
`,
};

const NOTES_TEST_THROUGH_THE_APP_CONFIG: Readonly<Record<string, string>> = {
	"src/notes.test.ts": NOTES_TEST_FILE,
	"vitest.config.mjs": `import { appTestConfig } from "@shivaedev/build/adapters/appTestConfig.ts";

export default appTestConfig(["@shivaedev/source"]);
`,
};

export const VITE_PROJECT = {
	notesPage: NOTES_PAGE,
	notesTest: NOTES_TEST,
	notesTestThroughTheAppConfig: NOTES_TEST_THROUGH_THE_APP_CONFIG,
	pageImportingTheTagsClient: PAGE_IMPORTING_THE_TAGS_CLIENT,
	screenImportingTheModule: SCREEN_IMPORTING_THE_MODULE,
	serverCodePages: SERVER_CODE_PAGES,
	tagsModule: TAGS_MODULE,
};
