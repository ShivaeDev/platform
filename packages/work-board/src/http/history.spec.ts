import { Effect, Layer, PlatformError } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { MAX_BYTES } from "#history/limits.ts";
import type { HistoryInput } from "#history/schema.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { changesUntil, rpcHistory, subscribe } from "#test/nativeRpc.ts";

let notes: Folder;
let board: RunningBoard;

const setupBoard = Effect.gen(function* () {
	notes = folder({ "home.md": "# Home", "nested/item.md": "---\nid: stable\n---\n# First" });
	board = yield* startBoard(notes.root, "home.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

function query(action: typeof HistoryInput.Type.action, baseline: string | null = null) {
	return rpcHistory(board, action, baseline);
}

effectApp("offers explicit browser retention without storing anything on GET, then compares complete observed sources", function* () {
	const page = yield* rawGet(board, "/_board/changes");
	expect(page.status).toBe(200);
	expect(page.body).toContain('id="history-mark" type="button" disabled');
	expect(page.body).toContain('aria-current="page">Changes');
	expect((yield* query("compare")).html).toContain("No previous snapshot");
	const observed = yield* query("observe");
	expect(observed.snapshot).toContain("# First");
	const events = yield* subscribe(board);
	yield* events.next();
	notes.write("nested/item.md", "---\nid: stable\nstatus: done\n---\n# Second");
	yield* changesUntil(events, "nested/item.md");
	yield* events.close();
	const result = yield* query("compare", observed.snapshot);
	expect(result.html).toContain("1 changed");
	expect(result.html).toContain("Recorded status changed (not acceptance)");
	expect(result.html).toContain("# First");
	expect(result.html).toContain("# Second");
	expect((yield* query("compare")).html).toContain("No previous snapshot");
});

effectApp("rejects cross-origin private queries and discards an invalid baseline", function* () {
	const response = yield* Effect.promise(() =>
		fetch(`${board.url}/_board/rpc`, {
			body: `${JSON.stringify({ _tag: "Request", id: "1", payload: { action: "check", baseline: null }, tag: "work-board.history" })}\n`,
			headers: { "content-type": "application/ndjson", origin: "http://example.test" },
			method: "POST",
		}),
	);
	expect(response.status).toBe(403);
	expect((yield* rawGet(board, "/_board/changes", "example.test")).status).toBe(403);
	expect((yield* query("check", "broken")).discardBaseline).toBe(true);
});

effectApp("preserves valid history and infers no removals when a current source cannot be read", function* () {
	const prior = (yield* query("observe")).snapshot;
	yield* board.stop();
	board = yield* startBoard(notes.root, "home.md", (fs) => ({
		...fs,
		readFileString: (path, ...args) =>
			path.endsWith("item.md")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem", pathOrDescriptor: path }))
				: fs.readFileString(path, ...args),
	}));
	const result = yield* query("compare", prior);
	expect(result.snapshot).toBeNull();
	expect(result.discardBaseline).toBe(false);
	expect(result.html).toContain("incomplete");
	expect(result.html).not.toContain("1 removed");
});

effectApp("declines an oversized complete workspace rather than retaining a partial snapshot", function* () {
	notes.write("huge.md", "界".repeat(MAX_BYTES / 2));
	const result = yield* query("observe");
	expect(result.snapshot).toBeNull();
	expect(result.reason).toContain("2 MiB");
});

effectApp("bounds native query bodies before accepting retained source data", function* () {
	const status = yield* Effect.promise(() =>
		fetch(`${board.url}/_board/rpc`, {
			body: `${JSON.stringify({ _tag: "Request", id: "1", payload: { action: "check", baseline: "x".repeat(4 * MAX_BYTES + 4096) }, tag: "work-board.history" })}\n`,
			headers: { "content-type": "application/ndjson" },
			method: "POST",
		}).then(
			(response) => response.status,
			(cause: unknown) => {
				expect(cause).toBeInstanceOf(TypeError);
				return "connection closed";
			},
		),
	);
	expect([400, "connection closed"]).toContain(status);
	expect((yield* query("check")).reason).toContain("No previous snapshot");
});
