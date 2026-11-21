import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notesApplication, notesTestInTheClientFolder, pageInTheClientFolder, solutionTsconfig, vite } from "#test/vite.ts";

const NOTES = "src/generated/modules/notes/notes.ts";
const TAGS = "src/generated/modules/tags/tags.ts";

vite.it(
	"the dev server rooted at src/client generates the notes client of the project above it",
	[notesApplication(), pageInTheClientFolder("the generated notes client")],
	function* ({ generatedFile, startsTheDevServer }) {
		expect(yield* generatedFile(NOTES)).toBe("missing");

		yield* outcomes([
			["the dev server", () => startsTheDevServer(), "started"],
			["the generated client", () => generatedFile(NOTES), expect.stringContaining("export const Notes = clientContract(")],
		]);
	},
);

vite.it(
	"in the dev server rooted at src/client, a module file created under src outside that root is generated and reloads the browser",
	[notesApplication(), pageInTheClientFolder("the generated notes client")],
	function* ({ browserReceives, createsTheTagsModule, generatedFile, startsTheDevServer }) {
		yield* startsTheDevServer();

		yield* createsTheTagsModule();

		yield* outcomes([
			["the browser", () => browserReceives(), { reloadAfter: "src/modules/tags/tags.ts" }],
			["the generated tags client", () => generatedFile(TAGS), expect.stringContaining("export const Tags = clientContract(")],
		]);
	},
);

vite.it(
	"vite build rooted at src/client fails when the page's script imports a file under a server folder, printing the chain from the project's root",
	[notesApplication(), pageInTheClientFolder("a file under a server folder")],
	function* ({ builds }) {
		const built = yield* builds();

		expect(built).toEqual({
			failed: expect.stringContaining(
				"Server code reached the browser bundle: src/server/session.ts is under a server/ folder. The import chain from the client entry:\n  src/client/index.html\n  → src/client/main.ts\n  → src/server/session.ts\n",
			),
		});
	},
);

vite.it(
	"a vitest run rooted at src/client generates the notes wire of the project above it before the test file that imports it loads",
	[notesApplication(), notesTestInTheClientFolder()],
	function* ({ runsVitest }) {
		const run = yield* runsVitest();

		expect(run).toEqual({ ran: { "the generated notes wire lists the module's operations": "passed" } });
	},
);

vite.it(
	"vite build refuses a tsconfig.json that only references other projects, saying where to run from instead of finding no module",
	[notesApplication(), solutionTsconfig()],
	function* ({ builds, generatedFile }) {
		const built = yield* builds();

		yield* outcomes([
			[
				"vite build",
				() => Effect.succeed(built),
				{
					failed: expect.stringContaining(
						"tsconfig.json holds no files of its own, only references to other projects, so no module can be found; run from the package that holds the modules, or give that package a tsconfig.json that includes them",
					),
				},
			],
			["the generated client", () => generatedFile(NOTES), "missing"],
		]);
	},
);
