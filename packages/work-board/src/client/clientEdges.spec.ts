import { chmodSync } from "node:fs";
import { join } from "node:path";
import { Effect, SchemaIssue } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"reports canceled atom reads as AbortError while keeping the server usable",
	[projectFiles({ "note.md": "# Reading context" })],
	function* ({ board, client }) {
		const signal = AbortSignal.abort();
		yield* Effect.promise(() =>
			expect(client.read(client.api.document.query({ url: "/note.md" }), signal)).rejects.toMatchObject({
				message: "Reading canceled",
				name: "AbortError",
			}),
		);
		expect((yield* Effect.promise(() => fetch(`${board.url}/note.md`))).status).toBe(200);
	},
);

boardStory.it(
	"reports canceled direct RPC reads as AbortError while keeping the server usable",
	[projectFiles({ "note.md": "# Reading context" })],
	function* ({ board, client }) {
		yield* Effect.promise(() =>
			expect(client.run(client.api.document.run({ url: "/note.md" }), AbortSignal.abort())).rejects.toMatchObject({
				message: "Reading canceled",
				name: "AbortError",
			}),
		);
		expect((yield* Effect.promise(() => fetch(`${board.url}/note.md`))).status).toBe(200);
	},
);

boardStory.it(
	"preserves the typed document read error when a real source file becomes unreadable",
	[projectFiles({ "note.md": "# Reading context" })],
	function* ({ notes, client }) {
		chmodSync(join(notes.root, "note.md"), 0o000);
		try {
			yield* Effect.promise(() =>
				expect(client.read(client.api.document.query({ url: "/note.md" }))).rejects.toMatchObject({
					_tag: "InternalServerError",
				}),
			);
		} finally {
			chmodSync(join(notes.root, "note.md"), 0o644);
		}
	},
);

boardStory.it(
	"rejects external or malformed native reading URLs with a precise schema diagnostic",
	[projectFiles({ "note.md": "# Reading context" })],
	function* ({ client }) {
		const activeClient = client;
		for (const url of ["https://example.com/note.md", "//example.com/note.md", "/\\["]) {
			const error: unknown = yield* Effect.promise(() =>
				activeClient.run(activeClient.api.document.run({ url })).then(
					() => undefined,
					(failure: unknown) => failure,
				),
			);
			if (!(error instanceof Error && SchemaIssue.isIssue(error.cause))) {
				throw new Error("Expected a schema issue for the reading URL");
			}
			expect(SchemaIssue.makeFormatterDefault()(error.cause)).toContain("Expected a local reading URL");
		}
	},
);
