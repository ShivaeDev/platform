import { fileURLToPath } from "node:url";

// The browser side of the notes project: a page whose script imports the generated client, as an application's does.
export const NOTES_PAGE: Readonly<Record<string, string>> = {
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

// A screen that reaches the notes module itself instead of its generated client.
export const SCREEN_IMPORTING_THE_MODULE: Readonly<Record<string, string>> = {
	"src/client.ts": `import { notesScreen } from "#screens/notes.ts";

console.log(notesScreen);
`,
	"src/screens/notes.ts": `import { Notes } from "#modules/notes/notes.ts";

export const notesScreen = { module: Notes };
`,
};

// Pages whose script reaches one kind of server code directly, each with the file the chain ends at.
export const SERVER_CODE_PAGES = {
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
	"effect/sql": {
		"src/client.ts": `import { SqlClient } from "effect/sql";

console.log(SqlClient);
`,
	},
} satisfies Record<string, Readonly<Record<string, string>>>;

const CONDITIONS = JSON.stringify(["@shivaedev/source", "node", "development|production"]);

// A test file that reads the generated wire the moment it loads, and the Vitest config that sets the generator up. The
// global setup runs from this package's sources, which Vitest's own environment resolves only with the source condition.
export const NOTES_TEST: Readonly<Record<string, string>> = {
	"src/notes.test.ts": `import { expect, test } from "vitest";
import { notesWire } from "#generated/modules/notes/notes.ts";

test("the generated notes wire lists the module's operations", () => {
	expect(Object.keys(notesWire)).toContain("list");
});
`,
	"vitest.config.mjs": `export default {
	environments: { __vitest__: { resolve: { conditions: ${CONDITIONS} } } },
	ssr: { resolve: { conditions: ${CONDITIONS} } },
	test: { globalSetup: [${JSON.stringify(fileURLToPath(new URL("../adapters/vitestSetup.ts", import.meta.url)))}], include: ["src/**/*.test.ts"] },
};
`,
};
