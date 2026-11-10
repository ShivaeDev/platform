import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesApplication, pageImporting, refusedModule, screenImportingTheModule, vite } from "#test/vite.ts";

const NOTES = "src/generated/modules/notes/notes.ts";

vite.it(
	"vite build generates the notes client before it bundles the page that imports it",
	[notesApplication()],
	function* ({ builds, generatedFile }) {
		expect(yield* generatedFile(NOTES)).toBe("missing");

		yield* outcomes([
			["vite build", () => builds(), "built"],
			["the generated client", () => generatedFile(NOTES), expect.stringContaining("export const Notes = clientContract(")],
		]);
	},
);

vite.it(
	"vite build fails when a screen imports the notes module, printing the chain from the page to the module file",
	[notesApplication(), screenImportingTheModule()],
	function* ({ builds }) {
		const built = yield* builds();

		expect(built).toEqual({
			failed: expect.stringContaining(
				"Server code reached the browser bundle: src/modules/notes/notes.ts is a module file: it calls defineModule. The import chain from the client entry:\n  index.html\n  → src/client.ts\n  → src/screens/notes.ts\n  → src/modules/notes/notes.ts\n",
			),
		});
	},
);

const CHAIN_ENDS = [
	["a file under a server folder", [], "src/server/session.ts is under a server/ folder"],
	["a Node builtin", [], "node:fs is a Node builtin"],
	["a package listed as server-only", ["fixture-queue"], "fixture-queue/index.js is part of fixture-queue, which is listed as server-only"],
	["an operation file", [], "src/modules/notes/list.ts is an operation file: it defines a query or a command"],
	["effect/sql", [], "effect/dist/sql/index.js is Effect's SQL client, effect/sql"],
] as const;

for (const [kind, serverOnly, end] of CHAIN_ENDS) {
	vite.it(
		`vite build fails when the page's script imports ${kind}, naming it at the end of the chain`,
		[notesApplication(), pageImporting(kind)],
		function* ({ builds }) {
			const built = yield* builds(...serverOnly);

			expect(built).toEqual({
				failed: expect.stringContaining(
					`Server code reached the browser bundle: ${end}. The import chain from the client entry:\n  index.html\n  → src/client.ts\n  → `,
				),
			});
		},
	);
}

vite.it("vite build stops on a refusal with the generator's message", [notesApplication(), refusedModule()], function* ({ builds }) {
	const built = yield* builds();

	expect(built).toEqual({
		failed: expect.stringContaining(
			"refused.returnsMap: run returns Map<string, number> at success, which has no exact wire form; return a plain object, an array or a string-keyed record",
		),
	});
});

vite.it(
	"vite build fails when a repository deep behind the page imports effect/sql, though Effect's own index reaches effect/sql sooner",
	[notesApplication(), pageImporting("effect at its entry and, four imports deeper, a repository on effect/sql/SqlClient")],
	function* ({ builds }) {
		const built = yield* builds();

		expect(built).toEqual({
			failed: expect.stringContaining(
				"Server code reached the browser bundle: effect/dist/sql/SqlClient.js is Effect's SQL client, effect/sql. The import chain from the client entry:\n  index.html\n  → src/client.ts\n  → src/screens/notes.ts\n  → src/screens/list.ts\n  → src/data/notes.ts\n  → src/data/repository.ts\n  → effect/dist/sql/SqlClient.js\n",
			),
		});
	},
);
