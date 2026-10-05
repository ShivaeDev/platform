import { renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, PlatformError } from "effect";
import { afterEach, beforeEach, expect, it } from "vitest";
import { changesUntil, type Folder, folder, type RunningBoard, rawGet, startBoard, subscribe } from "#test/board.ts";
import { identityFixture } from "#test/identityFixture.ts";

let notes: Folder;
let board: RunningBoard;
beforeEach(async () => {
	notes = folder(identityFixture());
	board = await startBoard(notes.root, "legacy.md");
});
afterEach(async () => {
	await board.stop();
	notes.remove();
});

it("renders optional work fields, criteria/evidence claims, source locations, and ordinary boards", async () => {
	const item = await rawGet(board, "/_board/item/work.search/");
	expect(item.status).toBe(200);
	expect(item.body).toContain('data-file="items/search &amp; review.md"');
	expect(item.body).toContain('data-identity="work.search"');
	expect(item.body).toContain('id="criterion-keyboard"');
	expect(item.body).toContain('href="/_board/item/decision.search/"');
	expect(item.body).toContain('href="/evidence.md"');
	expect(item.body).toContain("not independently verified");
	expect(item.body).toContain("items/search &amp; review.md:2");
	expect(item.body).toContain("Readable project prose.");
	const legacy = await rawGet(board, "/");
	expect(legacy.body).toContain('class="item"');
	expect(legacy.body).not.toContain('class="work-meta"');
	const blocked = await rawGet(board, "/_board/item/work.search/", "evil.example");
	expect(blocked.status).toBe(403);
});

it("keeps identity URLs valid after heading edits and file renames and makes deletion explicit", async () => {
	const events = await subscribe(board);
	await events.next();
	try {
		expect((await rawGet(board, "/_board/item/work.search/")).status).toBe(200);
		notes.write(
			"items/search & review.md",
			identityFixture()["items/search & review.md"]?.replace("# Search the workspace", "# Renamed heading") ?? "",
		);
		await changesUntil(events, "items/search & review.md");
		expect((await rawGet(board, "/_board/item/work.search/")).body).toContain("Renamed heading");
		renameSync(join(notes.root, "items/search & review.md"), join(notes.root, "renamed.md"));
		await changesUntil(events, "renamed.md");
		const renamed = await rawGet(board, "/_board/item/work.search/");
		expect(renamed.status).toBe(200);
		expect(renamed.body).toContain('data-file="renamed.md"');
		rmSync(join(notes.root, "renamed.md"));
		await changesUntil(events, "renamed.md");
		const missing = await rawGet(board, "/_board/item/work.search/");
		expect(missing.status).toBe(404);
		expect(missing.body).toContain("No item with ID work.search");
	} finally {
		events.close();
	}
});

it("returns a conflict for duplicate IDs and diagnoses references without choosing a source", async () => {
	const events = await subscribe(board);
	await events.next();
	try {
		notes.write("duplicate.md", "---\nid: work.search\n---\n# Another source");
		await changesUntil(events, "duplicate.md");
		const result = await rawGet(board, "/_board/item/work.search/");
		expect(result.status).toBe(409);
		expect(result.body).toContain("No document was selected");
		const decision = await rawGet(board, "/decision.md");
		expect(decision.body).toContain("Ambiguous reference work.search");
		const source = await rawGet(board, "/items/search%20%26%20review.md");
		expect(source.body).toContain("Duplicate ID work.search");
		expect(source.body).not.toContain('data-identity="work.search"');
	} finally {
		events.close();
	}
});

it("indexes declared IDs/status/owner and criteria at exact source locations", async () => {
	const body = await (await fetch(`${board.url}/_board/search?q=agent-navigation`)).json();
	expect(body.results[0].href).toBe("/_board/item/work.search/");
	expect(body.results[0].line).toBe(23);
	const criteria = await (await fetch(`${board.url}/_board/search?q=Escape%20returns%20focus`)).json();
	expect(criteria.results[0].href).toBe("/_board/item/work.search/#criterion-keyboard");
	expect(criteria.results[0].line).toBe(8);
	const prose = await (await fetch(`${board.url}/_board/search?q=Readable%20project%20prose`)).json();
	expect(prose.results[0].line).toBe(25);
});

it("keeps invalid and unknown metadata visible without making prose unreadable", async () => {
	notes.write(
		"bad.md",
		"---\nid: work.bad\nstatus: 7\nrisk_budget: strict\nrelationships:\n  - kind: informs\n    target: missing.id\n---\n# Readable body",
	);
	const result = await rawGet(board, "/bad.md");
	expect(result.status).toBe(200);
	expect(result.body).toContain("Invalid status");
	expect(result.body).toContain("Unknown field risk_budget");
	expect(result.body).toContain("Unresolved reference missing.id");
	expect(result.body).toContain("risk_budget: strict");
	expect(result.body).toContain("Readable body");
});

it("does not claim unique identity when part of the workspace cannot be read", async () => {
	await board.stop();
	board = await startBoard(notes.root, "legacy.md", (fs) => ({
		...fs,
		readFileString: (file, options) =>
			file.endsWith("decision.md")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
				: fs.readFileString(file, options),
	}));
	const result = await rawGet(board, "/_board/item/work.search/");
	expect(result.status).toBe(503);
	expect(result.body).toContain("index is incomplete");
	const normal = await rawGet(board, "/items/search%20%26%20review.md");
	expect(normal.status).toBe(200);
	expect(normal.body).toContain("Identity and references cannot be validated completely");
	expect(normal.body).not.toContain('data-identity="work.search"');
});

it("rebuilds identities from files after a server restart without stored index data", async () => {
	expect((await rawGet(board, "/_board/item/work.search/")).status).toBe(200);
	await board.stop();
	renameSync(join(notes.root, "items/search & review.md"), join(notes.root, "moved.md"));
	board = await startBoard(notes.root, "legacy.md");
	const result = await rawGet(board, "/_board/item/work.search/");
	expect(result.status).toBe(200);
	expect(result.body).toContain('data-file="moved.md"');
});

it("escapes metadata text and leaves executable evidence URLs as plain text", async () => {
	notes.write(
		"unsafe.md",
		"---\nid: work.unsafe\nowner: '<img src=x onerror=alert(1)>'\nevidence:\n  - source: 'javascript:alert(1)'\n---\n# Safe metadata",
	);
	const result = await rawGet(board, "/unsafe.md");
	expect(result.status).toBe(200);
	expect(result.body).toContain("&lt;img src=x onerror=alert(1)&gt;");
	expect(result.body).not.toContain("<img src=x");
	expect(result.body).not.toContain('href="javascript:');
});

it("keeps Markdown paths under the reserved prefix readable, including IDs ending in .md", async () => {
	notes.write("_board/item/source.md", "# A regular file under the route prefix");
	notes.write("named.md", "---\nid: source.md\n---\n# An explicitly identified item");
	const file = await rawGet(board, "/_board/item/source.md");
	expect(file.body).toContain("A regular file under the route prefix");
	expect((await rawGet(board, "/_board/item/source%2Emd")).body).toContain("A regular file under the route prefix");
	const item = await rawGet(board, "/_board/item/source.md/");
	expect(item.body).toContain("An explicitly identified item");
	expect(item.body).toContain('data-identity="source.md"');
});

it("does not retarget an item URL when its source identity changes between index and page reads", async () => {
	await board.stop();
	let reads = 0;
	board = await startBoard(notes.root, "legacy.md", (fs) => ({
		...fs,
		readFileString: (file, options) =>
			fs.readFileString(file, options).pipe(
				Effect.map((source) => {
					if (!file.endsWith("search & review.md")) {
						return source;
					}
					reads += 1;
					return reads > 1 ? source.replace("id: work.search", "id: work.replacement") : source;
				}),
			),
	}));
	const result = await rawGet(board, "/_board/item/work.search/");
	expect(result.status).toBe(404);
	expect(result.body).toContain("its source identity changed or is invalid");
	expect(result.body).not.toContain('data-identity="work.replacement"');
});
