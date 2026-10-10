import { chmodSync } from "node:fs";
import { join } from "node:path";
import { SchemaIssue } from "effect";
import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});
async function open() {
	notes = folder({ "note.md": "# Reading context" });
	board = await startBoard(notes.root);
	client = browserClient(board.url);
}

it("reports canceled atom reads as AbortError while keeping the server usable", async () => {
	await open();
	const signal = AbortSignal.abort();
	await expect(client.read(client.api.page.query({ url: "/note.md" }), signal)).rejects.toMatchObject({
		message: "Reading canceled",
		name: "AbortError",
	});
	expect((await fetch(`${board.url}/note.md`)).status).toBe(200);
});

it("reports canceled direct RPC reads as AbortError while keeping the server usable", async () => {
	await open();
	await expect(client.run(client.api.page.run({ url: "/note.md" }), AbortSignal.abort())).rejects.toMatchObject({
		message: "Reading canceled",
		name: "AbortError",
	});
	expect((await fetch(`${board.url}/note.md`)).status).toBe(200);
});

it("preserves the typed page read error when a real source file becomes unreadable", async () => {
	await open();
	chmodSync(join(notes.root, "note.md"), 0o000);
	try {
		await expect(client.read(client.api.page.query({ url: "/note.md" }))).rejects.toMatchObject({
			_tag: "ReadFailed",
			operation: "page",
			status: 500,
		});
	} finally {
		chmodSync(join(notes.root, "note.md"), 0o644);
	}
});

it("rejects external or malformed native reading URLs with a precise schema diagnostic", async () => {
	await open();
	for (const url of ["https://example.com/note.md", "//example.com/note.md", "/\\["]) {
		const error: unknown = await client.run(client.api.page.run({ url })).then(
			() => undefined,
			(failure: unknown) => failure,
		);
		if (!(error instanceof Error && SchemaIssue.isIssue(error.cause))) {
			throw new Error("Expected a schema issue for the reading URL");
		}
		expect(SchemaIssue.makeFormatterDefault()(error.cause)).toContain("Expected a local reading URL");
	}
});
