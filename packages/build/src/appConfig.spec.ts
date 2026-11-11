import { expect } from "vitest";
import { generatedOnce, notesApplication, notesTestThroughTheAppConfig, pageImporting, vite } from "#test/vite.ts";

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
