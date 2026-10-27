import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { describe, expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { faultyWatch } from "#test/faults.ts";
import { changesUntil, rpcDocument, rpcPaths, rpcWatcher } from "#test/nativeRpc.ts";
import { nestedProject } from "#test/servingTraits.ts";

const liveProject = [
	projectFiles({ "notes/log.md": "# Log\n", "plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n" }),
	boardHome("plan.md"),
];

describe("live updates", () => {
	boardStory.it("pushes a change event naming the markdown file that was written", liveProject, function* ({ board, watchProject, editFile }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		expect((yield* rpcWatcher(board)).watching).toBe(true);
		editFile("notes/log.md", "# Log\n\nA new line.\n");
		expect(yield* changesUntil(events, "notes/log.md")).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "notes/log.md" }]),
		});
		yield* events.close();
	});

	boardStory.it("never names a file that is not markdown", liveProject, function* ({ board, watchProject, editFile }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		expect((yield* rpcWatcher(board)).watching).toBe(true);
		editFile("notes/raw.txt", "plain\n");
		editFile("plan.md", "# Plan\n");
		const hint = yield* changesUntil(events, "plan.md");
		expect(hint).toMatchObject({ _tag: "Changed" });
		expect(JSON.stringify(hint)).not.toContain("notes/raw.txt");
		yield* events.close();
	});

	boardStory.it("settles changes that land together into one event", liveProject, function* ({ board, watchProject, editFile }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		expect((yield* rpcWatcher(board)).watching).toBe(true);
		editFile("notes/log.md", "# Log\n\nOne.\n");
		editFile("plan.md", "# Plan\n\nTwo.\n");
		const seen = yield* changesUntil(events, "plan.md");
		expect(seen).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining([
				{ _tag: "Item", collection: "work-board/documents", id: "notes/log.md" },
				{ _tag: "Item", collection: "work-board/documents", id: "plan.md" },
			]),
		});
		yield* events.close();
	});

	boardStory.it("serves and announces a file in a new folder without a restart", liveProject, function* ({ board, watchProject, editFile }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		expect((yield* rpcWatcher(board)).watching).toBe(true);
		editFile("later/idea.md", "# Idea\n");
		yield* changesUntil(events, "later/idea.md");
		const page = yield* Effect.map(rpcDocument(board, "/later/idea.md"), (data) => data.source);
		expect(page).toContain("# Idea");
		expect(yield* rpcPaths(board)).toContain("/later/idea.md");
		yield* events.close();
	});

	boardStory.it("shows an edit on the next request without a rebuild", liveProject, function* ({ board, editFile }) {
		editFile("plan.md", "# Plan\n\n## To do\n\n### One\n\n### Two\n");
		expect((yield* rpcDocument(board, "/plan.md")).source).toContain("### Two");
	});
});

describe("watcher recovery", () => {
	boardStory.it(
		"says the folder is not watched after the watcher fails, restarts it with backoff and reports changes again",
		liveProject,
		function* ({ board, start, watchProject, editFile }) {
			yield* board.stop();
			const faults = faultyWatch();
			board = yield* start({ home: "plan.md", wrap: faults.wrap });
			const events = yield* watchProject();
			expect(yield* events.next()).toEqual({ _tag: "Resync" });
			expect((yield* rpcWatcher(board)).watching).toBe(true);
			yield* faults.fail();
			expect(yield* events.watching(false)).toBe(false);
			const late = yield* watchProject();
			expect(yield* late.next()).toEqual({ _tag: "Resync" });
			expect((yield* rpcWatcher(board)).watching).toBe(false);
			yield* late.close();
			faults.heal();
			expect(yield* events.watching(true)).toBe(true);
			editFile("notes/log.md", "# Log\n\nAfter the restart.\n");
			expect(yield* changesUntil(events, "notes/log.md")).toMatchObject({
				_tag: "Changed",
				keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "notes/log.md" }]),
			});
			yield* events.close();
		},
	);

	boardStory.it("waits longer between each restart while the watcher keeps failing", liveProject, function* ({ board, start, watchProject }) {
		yield* board.stop();
		const faults = faultyWatch();
		board = yield* start({ home: "plan.md", wrap: faults.wrap });
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		expect((yield* rpcWatcher(board)).watching).toBe(true);
		yield* faults.fail();
		expect(yield* events.watching(false)).toBe(false);
		yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 1500)));
		yield* events.close();
		const retries = faults.attempts.slice(1);
		const gaps = retries.slice(1).map((at, index) => at - (retries[index] ?? at));
		expect(retries.length).toBeGreaterThanOrEqual(3);
		expect(retries.length).toBeLessThanOrEqual(8);
		expect(gaps.every((gap, index) => gap > (gaps[index - 1] ?? 0))).toBe(true);
	});
});

describe("a folder whose own name starts with a dot", () => {
	boardStory.it(
		"lists, serves and watches it, and still skips dot folders and node_modules inside it",
		[
			nestedProject(".notes"),
			projectFiles({ ".hidden/x.md": "# Hidden", "node_modules/x.md": "# Dependency", "notes/log.md": "# Log", "plan.md": "# Plan" }),
			boardHome("plan.md"),
		],
		function* ({ board, editFile, watchProject }) {
			const home = yield* Effect.promise(async () => (await fetch(board.url)).text());
			expect(home).toContain("data-board-react-root");
			expect(yield* rpcPaths(board)).toContain("/notes/log.md");
			expect(yield* rpcPaths(board)).toEqual(["/notes/log.md", "/plan.md"]);
			expect((yield* rpcDocument(board, "/notes/log.md")).source).toContain("# Log");
			expect((yield* Effect.promise(() => fetch(`${board.url}/.hidden/x.md`))).status).toBe(HttpStatus.fromLiteral("NotFound"));
			expect((yield* Effect.promise(() => fetch(`${board.url}/node_modules/x.md`))).status).toBe(HttpStatus.fromLiteral("NotFound"));
			const events = yield* watchProject();
			expect(yield* events.next()).toEqual({ _tag: "Resync" });
			expect((yield* rpcWatcher(board)).watching).toBe(true);
			editFile(".hidden/x.md", "# Hidden, edited\n");
			editFile("notes/log.md", "# Log\n\nEdited.\n");
			const seen = yield* changesUntil(events, "notes/log.md");
			expect(JSON.stringify(seen)).not.toContain(".hidden/x.md");
			yield* events.close();
		},
	);
});
