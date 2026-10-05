import { Effect, PlatformError, Schema } from "effect";
import { afterEach, beforeEach, expect, it } from "vitest";
import { MAX_BYTES } from "#history/limits.ts";
import { HistoryOutput } from "#history/schema.ts";
import { changesUntil, type Folder, folder, type RunningBoard, rawGet, startBoard, subscribe } from "#test/board.ts";

let notes: Folder;
let board: RunningBoard;
beforeEach(async () => {
	notes = folder({ "home.md": "# Home", "nested/item.md": "---\nid: stable\n---\n# First" });
	board = await startBoard(notes.root, "home.md");
});
afterEach(async () => {
	await board.stop();
	notes.remove();
});
async function query(action: string, baseline: string | null = null) {
	const response = await fetch(`${board.url}/_board/history`, {
		body: JSON.stringify({ action, baseline }),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
	expect(response.status).toBe(200);
	return Schema.decodeUnknownSync(Schema.fromJsonString(HistoryOutput))(await response.text());
}
it("offers explicit browser retention without storing anything on GET, then compares complete observed sources", async () => {
	const page = await rawGet(board, "/_board/changes");
	expect(page.status).toBe(200);
	expect(page.body).toContain('id="history-mark" type="button" disabled');
	expect(page.body).toContain('aria-current="page">Changes');
	expect((await query("compare")).html).toContain("No previous snapshot");
	const observed = await query("observe");
	expect(observed.snapshot).toContain("# First");
	const events = await subscribe(board);
	await events.next();
	notes.write("nested/item.md", "---\nid: stable\nstatus: done\n---\n# Second");
	await changesUntil(events, "nested/item.md");
	events.close();
	const result = await query("compare", observed.snapshot);
	expect(result.html).toContain("1 changed");
	expect(result.html).toContain("Recorded status changed (not acceptance)");
	expect(result.html).toContain("# First");
	expect(result.html).toContain("# Second");
	expect((await query("compare")).html).toContain("No previous snapshot");
});
it("rejects unknown input and cross-origin private queries", async () => {
	const endpoint = `${board.url}/_board/history`;
	for (const body of [
		{ action: "write", baseline: null },
		{ action: "check", baseline: null, extra: true },
	]) {
		expect((await fetch(endpoint, { body: JSON.stringify(body), method: "POST" })).status).toBe(400);
	}
	expect(
		(await fetch(endpoint, { body: JSON.stringify({ action: "check", baseline: null }), headers: { origin: "http://example.test" }, method: "POST" }))
			.status,
	).toBe(403);
	expect((await rawGet(board, "/_board/changes", "example.test")).status).toBe(403);
	expect((await query("check", "broken")).discardBaseline).toBe(true);
});
it("preserves valid history and infers no removals when a current source cannot be read", async () => {
	const prior = (await query("observe")).snapshot;
	await board.stop();
	board = await startBoard(notes.root, "home.md", (fs) => ({
		...fs,
		readFileString: (path, ...args) =>
			path.endsWith("item.md")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem", pathOrDescriptor: path }))
				: fs.readFileString(path, ...args),
	}));
	const result = await query("compare", prior);
	expect(result.snapshot).toBeNull();
	expect(result.discardBaseline).toBe(false);
	expect(result.html).toContain("incomplete");
	expect(result.html).not.toContain("1 removed");
});
it("declines an oversized complete workspace rather than retaining a partial snapshot", async () => {
	notes.write("huge.md", "界".repeat(MAX_BYTES / 2));
	const result = await query("observe");
	expect(result.snapshot).toBeNull();
	expect(result.reason).toContain("2 MiB");
});

it("bounds native query bodies before accepting retained source data", async () => {
	const status = await fetch(`${board.url}/_board/history`, {
		body: JSON.stringify({ action: "check", baseline: "x".repeat(4 * MAX_BYTES + 4096) }),
		headers: { "content-type": "application/json" },
		method: "POST",
	}).then(
		(response) => response.status,
		(cause: unknown) => {
			expect(cause).toBeInstanceOf(TypeError);
			return "connection closed";
		},
	);
	expect([400, "connection closed"]).toContain(status);
	expect((await query("check")).reason).toContain("No previous snapshot");
});
