import { renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer, PlatformError } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { identityFixture } from "#test/identityFixture.ts";
import { changesUntil, rpcSearch, subscribe } from "#test/nativeRpc.ts";

let notes: Folder;
let board: RunningBoard;

const setupBoard = Effect.gen(function* () {
	notes = folder(identityFixture());
	board = yield* startBoard(notes.root, "legacy.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

effectApp("serves item URLs with either trailing-slash form and reports unknown IDs", function* () {
	for (const slash of ["", "/"]) {
		const item = yield* rawGet(board, `/_board/item/work.search${slash}`);
		expect(item.status).toBe(200);
		expect(item.body).toContain('data-identity="work.search"');
		expect(item.body).toContain("Readable project prose.");
		const missing = yield* rawGet(board, `/_board/item/missing${slash}`);
		expect(missing.status).toBe(404);
		expect(missing.body).toContain("No item with ID missing");
	}
});

effectApp("renders optional work fields, criteria/evidence claims, source locations, and ordinary boards", function* () {
	const item = yield* rawGet(board, "/_board/item/work.search/");
	expect(item.status).toBe(200);
	expect(item.body).toContain('data-file="items/search &amp; review.md"');
	expect(item.body).toContain('data-identity="work.search"');
	expect(item.body).toContain('id="criterion-keyboard"');
	expect(item.body).toContain('href="/_board/item/decision.search/"');
	expect(item.body).toContain('href="/evidence.md"');
	expect(item.body).toContain("not independently verified");
	expect(item.body).toContain("items/search &amp; review.md:2");
	expect(item.body).toContain("Readable project prose.");
	const legacy = yield* rawGet(board, "/");
	expect(legacy.body).toContain('class="item"');
	expect(legacy.body).not.toContain('class="work-meta"');
	const blocked = yield* rawGet(board, "/_board/item/work.search/", "evil.example");
	expect(blocked.status).toBe(403);
});

effectApp("keeps identity URLs valid after heading edits and file renames and makes deletion explicit", function* () {
	const events = yield* subscribe(board);
	yield* events.next();
	try {
		expect((yield* rawGet(board, "/_board/item/work.search/")).status).toBe(200);
		notes.write(
			"items/search & review.md",
			identityFixture()["items/search & review.md"]?.replace("# Search the workspace", "# Renamed heading") ?? "",
		);
		yield* changesUntil(events, "items/search & review.md");
		expect((yield* rawGet(board, "/_board/item/work.search/")).body).toContain("Renamed heading");
		renameSync(join(notes.root, "items/search & review.md"), join(notes.root, "renamed.md"));
		yield* changesUntil(events, "renamed.md");
		const renamed = yield* rawGet(board, "/_board/item/work.search/");
		expect(renamed.status).toBe(200);
		expect(renamed.body).toContain('data-file="renamed.md"');
		rmSync(join(notes.root, "renamed.md"));
		yield* changesUntil(events, "renamed.md");
		const missing = yield* rawGet(board, "/_board/item/work.search/");
		expect(missing.status).toBe(404);
		expect(missing.body).toContain("No item with ID work.search");
	} finally {
		yield* events.close();
	}
});

effectApp("returns a conflict for duplicate IDs and diagnoses references without choosing a source", function* () {
	const events = yield* subscribe(board);
	yield* events.next();
	try {
		notes.write("duplicate.md", "---\nid: work.search\n---\n# Another source");
		yield* changesUntil(events, "duplicate.md");
		const result = yield* rawGet(board, "/_board/item/work.search/");
		expect(result.status).toBe(409);
		expect(result.body).toContain("No document was selected");
		const decision = yield* rawGet(board, "/decision.md");
		expect(decision.body).toContain("Ambiguous reference work.search");
		const source = yield* rawGet(board, "/items/search%20%26%20review.md");
		expect(source.body).toContain("Duplicate ID work.search");
		expect(source.body).not.toContain('data-identity="work.search"');
	} finally {
		yield* events.close();
	}
});

effectApp("indexes declared IDs/status/owner and criteria at exact source locations", function* () {
	const body = yield* rpcSearch(board, "agent-navigation");
	expect(body.results[0]?.href).toBe("/_board/item/work.search/");
	expect(body.results[0]?.line).toBe(23);
	const criteria = yield* rpcSearch(board, "Escape returns focus");
	expect(criteria.results[0]?.href).toBe("/_board/item/work.search/");
	expect(criteria.results.find((result) => result.href.endsWith("#criterion-keyboard"))?.line).toBe(8);
	const prose = yield* rpcSearch(board, "Readable project prose");
	expect(prose.results[0]?.href).toBe("/_board/item/work.search/");
	expect(prose.results.find((result) => result.kind === "passage")?.line).toBe(25);
});

effectApp("keeps invalid and unknown metadata visible without making prose unreadable", function* () {
	notes.write(
		"bad.md",
		"---\nid: work.bad\nstatus: 7\nrisk_budget: strict\nrelationships:\n  - kind: informs\n    target: missing.id\n---\n# Readable body",
	);
	const result = yield* rawGet(board, "/bad.md");
	expect(result.status).toBe(200);
	expect(result.body).toContain("Invalid status");
	expect(result.body).toContain("Unknown field risk_budget");
	expect(result.body).toContain("Unresolved reference missing.id");
	expect(result.body).toContain("risk_budget: strict");
	expect(result.body).toContain("Readable body");
});

effectApp("does not claim unique identity when part of the workspace cannot be read", function* () {
	yield* board.stop();
	board = yield* startBoard(notes.root, "legacy.md", (fs) => ({
		...fs,
		readFileString: (file, options) =>
			file.endsWith("decision.md")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
				: fs.readFileString(file, options),
	}));
	const result = yield* rawGet(board, "/_board/item/work.search/");
	expect(result.status).toBe(503);
	expect(result.body).toContain("index is incomplete");
	const normal = yield* rawGet(board, "/items/search%20%26%20review.md");
	expect(normal.status).toBe(200);
	expect(normal.body).toContain("Identity and references cannot be validated completely");
	expect(normal.body).not.toContain('data-identity="work.search"');
});

effectApp("rebuilds identities from files after a server restart without stored index data", function* () {
	expect((yield* rawGet(board, "/_board/item/work.search/")).status).toBe(200);
	yield* board.stop();
	renameSync(join(notes.root, "items/search & review.md"), join(notes.root, "moved.md"));
	board = yield* startBoard(notes.root, "legacy.md");
	const result = yield* rawGet(board, "/_board/item/work.search/");
	expect(result.status).toBe(200);
	expect(result.body).toContain('data-file="moved.md"');
});

effectApp("escapes metadata text and leaves executable evidence URLs as plain text", function* () {
	notes.write(
		"unsafe.md",
		"---\nid: work.unsafe\nowner: '<img src=x onerror=alert(1)>'\nevidence:\n  - source: 'javascript:alert(1)'\n---\n# Safe metadata",
	);
	const result = yield* rawGet(board, "/unsafe.md");
	expect(result.status).toBe(200);
	expect(result.body).toContain("&lt;img src=x onerror=alert(1)&gt;");
	expect(result.body).not.toContain("<img src=x");
	expect(result.body).not.toContain('href="javascript:');
});

effectApp("selects .md identities over colliding Markdown paths with either trailing-slash form", function* () {
	notes.write("_board/item/source.md", "# A regular file under the route prefix");
	notes.write("named.md", "---\nid: source.md\n---\n# An explicitly identified item");
	for (const url of ["/_board/item/source.md", "/_board/item/source.md/", "/_board/item/source%2Emd"]) {
		const item = yield* rawGet(board, url);
		expect(item.status).toBe(200);
		expect(item.body).toContain("An explicitly identified item");
		expect(item.body).toContain('data-identity="source.md"');
		expect(item.body).not.toContain("A regular file under the route prefix");
	}
});

effectApp("does not retarget an item URL when its source identity changes between index and page reads", function* () {
	yield* board.stop();
	let reads = 0;
	board = yield* startBoard(notes.root, "legacy.md", (fs) => ({
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
	const result = yield* rawGet(board, "/_board/item/work.search/");
	expect(result.status).toBe(404);
	expect(result.body).toContain("its source identity changed or is invalid");
	expect(result.body).not.toContain('data-identity="work.replacement"');
});
