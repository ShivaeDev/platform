import { chmodSync } from "node:fs";
import { join } from "node:path";
import { Effect, SchemaIssue } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;

afterEach(() => {
	client?.registry.dispose();
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* () {
	notes = folder({ "note.md": "# Reading context" });
	board = yield* startBoard(notes.root);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
});

it.live("reports canceled atom reads as AbortError while keeping the server usable", function* () {
	yield* open();
	const signal = AbortSignal.abort();
	yield* Effect.promise(() =>
		expect(client.read(client.api.page.query({ url: "/note.md" }), signal)).rejects.toMatchObject({
			message: "Reading canceled",
			name: "AbortError",
		}),
	);
	expect((yield* Effect.promise(() => fetch(`${board.url}/note.md`))).status).toBe(200);
});

it.live("reports canceled direct RPC reads as AbortError while keeping the server usable", function* () {
	yield* open();
	yield* Effect.promise(() =>
		expect(client.run(client.api.page.run({ url: "/note.md" }), AbortSignal.abort())).rejects.toMatchObject({
			message: "Reading canceled",
			name: "AbortError",
		}),
	);
	expect((yield* Effect.promise(() => fetch(`${board.url}/note.md`))).status).toBe(200);
});

it.live("preserves the typed page read error when a real source file becomes unreadable", function* () {
	yield* open();
	chmodSync(join(notes.root, "note.md"), 0o000);
	try {
		yield* Effect.promise(() =>
			expect(client.read(client.api.page.query({ url: "/note.md" }))).rejects.toMatchObject({
				_tag: "InternalServerError",
			}),
		);
	} finally {
		chmodSync(join(notes.root, "note.md"), 0o644);
	}
});

it.live("rejects external or malformed native reading URLs with a precise schema diagnostic", function* () {
	yield* open();
	const activeClient = client;
	for (const url of ["https://example.com/note.md", "//example.com/note.md", "/\\["]) {
		const error: unknown = yield* Effect.promise(() =>
			activeClient.run(activeClient.api.page.run({ url })).then(
				() => undefined,
				(failure: unknown) => failure,
			),
		);
		if (!(error instanceof Error && SchemaIssue.isIssue(error.cause))) {
			throw new Error("Expected a schema issue for the reading URL");
		}
		expect(SchemaIssue.makeFormatterDefault()(error.cause)).toContain("Expected a local reading URL");
	}
});
