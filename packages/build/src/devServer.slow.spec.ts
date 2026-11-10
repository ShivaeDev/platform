import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { successOf } from "#test/generatedText.ts";
import { notesApplication, refusedModule, vite } from "#test/vite.ts";

const NOTES = "src/generated/modules/notes/notes.ts";

function listSuccess(text: string) {
	return successOf(text, "list");
}

vite.it(
	"in the dev server, a new field on list's return type rewrites the generated client, invalidates the page script that imports it and reloads the browser",
	[notesApplication()],
	function* ({ browserLoadsThePage, browserReceives, edits, generatedFile, moduleGraphEntry, startsTheDevServer }) {
		yield* startsTheDevServer();
		yield* browserLoadsThePage();
		expect(yield* moduleGraphEntry("src/client.ts")).toBe("transformed");

		yield* edits("src/modules/notes/list.ts", "readonly createdAt: Date;", "readonly createdAt: Date;\n\treadonly archived: boolean;");

		yield* outcomes([
			["the browser", () => browserReceives(), "full reload"],
			["list's generated success", () => Effect.map(generatedFile(NOTES), listSuccess), expect.stringContaining("archived: Schema.Boolean")],
			["src/client.ts in Vite's module graph", () => moduleGraphEntry("src/client.ts"), "invalidated"],
		]);
	},
);

vite.it(
	"in the dev server, a return type the wire cannot carry shows the generator's refusal in the terminal and the error overlay and keeps the last generated client",
	[notesApplication()],
	function* ({ browserLoadsThePage, browserReceives, edits, generatedFile, startsTheDevServer, terminalErrors }) {
		yield* startsTheDevServer();
		yield* browserLoadsThePage();
		const before = yield* generatedFile(NOTES);

		yield* edits(
			"src/modules/notes/list.ts",
			"return listed(yield* store.rows);",
			"return new Map(listed(yield* store.rows).map((note) => [note.id, note]));",
		);

		const refusal =
			"notes.list: run returns Map<number, ListedNote> at success, which has no exact wire form; return a plain object, an array or a string-keyed record";
		yield* outcomes([
			["the browser", () => browserReceives(), { overlay: refusal }],
			["the terminal", () => terminalErrors(), [refusal]],
			["the generated client", () => generatedFile(NOTES), before],
		]);
	},
);

vite.it(
	"the dev server does not start while the generator refuses a module, and says why",
	[notesApplication(), refusedModule()],
	function* ({ startsTheDevServer }) {
		const started = yield* startsTheDevServer();

		expect(started).toEqual({
			failed: expect.stringContaining(
				"refused.returnsMap: run returns Map<string, number> at success, which has no exact wire form; return a plain object, an array or a string-keyed record",
			),
		});
	},
);
