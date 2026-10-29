import { chmodSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
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
		expect((yield* Effect.promise(() => fetch(`${board.url}/note.md`))).status).toBe(HttpStatus.fromLiteral("OK"));
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
		expect((yield* Effect.promise(() => fetch(`${board.url}/note.md`))).status).toBe(HttpStatus.fromLiteral("OK"));
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
