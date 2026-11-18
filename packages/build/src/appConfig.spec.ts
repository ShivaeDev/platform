import { expect } from "vitest";
import {
	billingContractImporting,
	generatedOnce,
	notesApplication,
	notesTestThroughTheAppConfig,
	pageImporting,
	pageImportingOldForm,
	vite,
} from "#test/vite.ts";

vite.it(
	"an application's vite build through appViteConfig fails when its page reaches server code",
	[notesApplication(), generatedOnce(), pageImporting("a file under a server folder")],
	function* ({ buildsWithTheAppConfig }) {
		const built = yield* buildsWithTheAppConfig();

		expect(built).toEqual({
			failed: expect.stringContaining("Server code reached the browser bundle: src/server/session.ts is under a server/ folder"),
		});
	},
);

vite.it(
	"an application still on the old operation form switches the bundle check off and builds",
	[notesApplication(), generatedOnce(), pageImporting("a file under a server folder")],
	function* ({ buildsWithTheAppConfig }) {
		const built = yield* buildsWithTheAppConfig({ bundleCheck: false });

		expect(built).toBe("built");
	},
);

for (const entry of ["src/modules/billing", "src/modules/bill*"]) {
	vite.it(
		`an application that lists ${entry} in oldFormFolders builds while its page imports the old-form contract of the billing folder`,
		[notesApplication(), generatedOnce(), pageImportingOldForm("the old-form contract of the billing folder")],
		function* ({ buildsWithTheAppConfig }) {
			const built = yield* buildsWithTheAppConfig({ oldFormFolders: [entry] });

			expect(built).toBe("built");
		},
	);
}

vite.it(
	"an old-form contract in a folder that oldFormFolders does not list still fails the build as an operation file",
	[notesApplication(), generatedOnce(), pageImportingOldForm("the old-form contracts of the billing and archive folders")],
	function* ({ buildsWithTheAppConfig }) {
		const built = yield* buildsWithTheAppConfig({ oldFormFolders: ["src/modules/billing"] });

		expect(built).toEqual({
			failed: expect.stringContaining(
				"Server code reached the browser bundle: src/modules/archive/contract.ts is an operation file: it defines a query or a command. The import chain from the client entry:\n  index.html\n  → src/client.ts\n  → src/modules/archive/contract.ts\n",
			),
		});
	},
);

const REACHED_THROUGH_BILLING = [
	["a file under a server folder", "src/server/session.ts is under a server/ folder", "src/server/session.ts"],
	["a Node builtin", "node:fs is a Node builtin", "node:fs"],
	[
		"an operation file of the defined notes module",
		"src/modules/notes/list.ts is an operation file: it defines a query or a command",
		"src/modules/notes/list.ts",
	],
	["effect/sql", "effect/dist/sql/index.js is Effect's SQL client, effect/sql", "effect/dist/sql/index.js"],
] as const;

for (const [kind, end, last] of REACHED_THROUGH_BILLING) {
	vite.it(
		`the build still fails when a contract in a folder listed in oldFormFolders imports ${kind}, printing the chain through the contract`,
		[notesApplication(), generatedOnce(), billingContractImporting(kind)],
		function* ({ buildsWithTheAppConfig }) {
			const built = yield* buildsWithTheAppConfig({ oldFormFolders: ["src/modules/billing"] });

			expect(built).toEqual({
				failed: expect.stringContaining(
					`Server code reached the browser bundle: ${end}. The import chain from the client entry:\n  index.html\n  → src/client.ts\n  → src/modules/billing/contract.ts\n  → ${last}\n`,
				),
			});
		},
	);
}

vite.it(
	"an oldFormFolders entry fails the build, naming the entry, once the page imports no old-form contract from its folder",
	[notesApplication(), generatedOnce()],
	function* ({ buildsWithTheAppConfig }) {
		const built = yield* buildsWithTheAppConfig({ oldFormFolders: ["src/modules/billing"] });

		expect(built).toEqual({
			failed: expect.stringContaining(
				"oldFormFolders lists folders from which the browser bundle imports no old-form contract or operation file:\n  src/modules/billing\nRemove each entry: the bundle check then covers its folder like the rest of the application.",
			),
		});
	},
);

vite.it(
	"an application's vite build through appViteConfig generates the notes client its page imports",
	[notesApplication()],
	function* ({ buildsWithTheAppConfig, generatedFile }) {
		const built = yield* buildsWithTheAppConfig({ bundleCheck: false });

		expect(built).toBe("built");
		expect(yield* generatedFile("src/generated/modules/notes/notes.ts")).toContain("export const Notes = clientContract(");
	},
);

vite.it(
	"vitest through appTestConfig generates the notes wire before the test file that imports it loads",
	[notesApplication(), notesTestThroughTheAppConfig()],
	function* ({ runsVitest }) {
		const run = yield* runsVitest();

		expect(run).toEqual({ ran: { "the generated notes wire lists the module's operations": "passed" } });
	},
);
