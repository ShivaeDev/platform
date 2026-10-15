import { join } from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { faultyWatch } from "#test/faults.ts";
import { changesUntil, type EventStream, rpcPaths, rpcWatcher, subscribe } from "#test/nativeRpc.ts";

let notes: Folder;
let board: RunningBoard;

const setupBoard = Effect.gen(function* () {
	notes = folder({ "notes/log.md": "# Log\n", "plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n" });
	board = yield* startBoard(notes.root, "plan.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
});

const ready = Effect.fn("Test.ready")(function* () {
	const events = yield* subscribe(board);
	expect(yield* events.next()).toEqual({ _tag: "Resync" });
	expect((yield* rpcWatcher(board)).watching).toBe(true);
	return events;
});

describe("live updates", () => {
	effectApp("pushes a change event naming the markdown file that was written", function* () {
		const events = yield* ready();
		notes.write("notes/log.md", "# Log\n\nA new line.\n");
		expect(yield* changesUntil(events, "notes/log.md")).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "notes/log.md" }]),
		});
		yield* events.close();
	});

	effectApp("never names a file that is not markdown", function* () {
		const events = yield* ready();
		notes.write("notes/raw.txt", "plain\n");
		notes.write("plan.md", "# Plan\n");
		const hint = yield* changesUntil(events, "plan.md");
		expect(hint).toMatchObject({ _tag: "Changed" });
		expect(JSON.stringify(hint)).not.toContain("notes/raw.txt");
		yield* events.close();
	});

	effectApp("settles changes that land together into one event", function* () {
		const events = yield* ready();
		notes.write("notes/log.md", "# Log\n\nOne.\n");
		notes.write("plan.md", "# Plan\n\nTwo.\n");
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

	effectApp("serves and announces a file in a new folder without a restart", function* () {
		const events = yield* ready();
		notes.write("later/idea.md", "# Idea\n");
		yield* changesUntil(events, "later/idea.md");
		const page = yield* Effect.promise(async () => (await fetch(`${board.url}/later/idea.md`)).text());
		expect(page).toContain(
			'<header class="item-introduction"><h1 id="heading-idea" tabindex="-1">Idea<a aria-label="Link to Idea" class="heading-anchor" href="#heading-idea"></a></h1>',
		);
		expect(yield* rpcPaths(board)).toContain("/later/idea.md");
		yield* events.close();
	});

	effectApp("shows an edit on the next request without a rebuild", function* () {
		notes.write("plan.md", "# Plan\n\n## To do\n\n### One\n\n### Two\n");
		expect(yield* Effect.promise(async () => (await fetch(board.url)).text())).toContain("<span><b>2</b> to do</span>");
	});
});

const nextWatching = Effect.fn("Test.nextWatching")(function* (events: EventStream, watching: boolean) {
	for (;;) {
		yield* events.next();
		if ((yield* rpcWatcher(board)).watching === watching) {
			return;
		}
	}
});

describe("watcher recovery", () => {
	effectApp("says the folder is not watched after the watcher fails, restarts it with backoff and reports changes again", function* () {
		yield* board.stop();
		const faults = faultyWatch();
		board = yield* startBoard(notes.root, "plan.md", faults.wrap);
		const events = yield* ready();
		yield* faults.fail();
		yield* nextWatching(events, false);
		const late = yield* subscribe(board);
		expect(yield* late.next()).toEqual({ _tag: "Resync" });
		expect((yield* rpcWatcher(board)).watching).toBe(false);
		yield* late.close();
		faults.heal();
		yield* nextWatching(events, true);
		notes.write("notes/log.md", "# Log\n\nAfter the restart.\n");
		expect(yield* changesUntil(events, "notes/log.md")).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "notes/log.md" }]),
		});
		yield* events.close();
	});

	effectApp("waits longer between each restart while the watcher keeps failing", function* () {
		yield* board.stop();
		const faults = faultyWatch();
		board = yield* startBoard(notes.root, "plan.md", faults.wrap);
		const events = yield* ready();
		yield* faults.fail();
		yield* nextWatching(events, false);
		yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 1500)));
		yield* events.close();
		const retries = faults.attempts.slice(1);
		const gaps = retries.slice(1).map((at, index) => at - (retries[index] ?? at));
		expect(retries.length).toBeGreaterThanOrEqual(3);
		expect(retries.length).toBeLessThanOrEqual(8);
		expect(gaps.every((gap, index) => gap > (gaps[index - 1] ?? 0))).toBe(true);
	});
});

let dotted: Folder;
let dotBoard: RunningBoard;

const setupDottedBoard = Effect.gen(function* () {
	yield* setupBoard;
	dotted = folder({
		".notes/.hidden/x.md": "# Hidden\n",
		".notes/node_modules/x.md": "# Dependency\n",
		".notes/notes/log.md": "# Log\n",
		".notes/plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n",
	});
	dotBoard = yield* startBoard(join(dotted.root, ".notes"), "plan.md");
});

const { effectApp: effectDottedBoard } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupDottedBoard });

describe("a folder whose own name starts with a dot", () => {
	afterEach(() => {
		dotted.remove();
	});

	effectDottedBoard("lists, serves and watches it, and still skips dot folders and node_modules inside it", function* () {
		const home = yield* Effect.promise(async () => (await fetch(dotBoard.url)).text());
		expect(home).toContain("<span><b>1</b> to do</span>");
		expect(yield* rpcPaths(dotBoard)).toContain("/notes/log.md");
		expect(yield* rpcPaths(dotBoard)).toEqual(["/notes/log.md", "/plan.md"]);
		expect(yield* Effect.promise(async () => (await fetch(`${dotBoard.url}/notes/log.md`)).text())).toContain(
			'<header class="item-introduction"><h1 id="heading-log" tabindex="-1">Log<a aria-label="Link to Log" class="heading-anchor" href="#heading-log"></a></h1>',
		);
		expect((yield* Effect.promise(() => fetch(`${dotBoard.url}/.hidden/x.md`))).status).toBe(404);
		expect((yield* Effect.promise(() => fetch(`${dotBoard.url}/node_modules/x.md`))).status).toBe(404);
		const events = yield* subscribe(dotBoard);
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		expect((yield* rpcWatcher(dotBoard)).watching).toBe(true);
		dotted.write(".notes/.hidden/x.md", "# Hidden, edited\n");
		dotted.write(".notes/notes/log.md", "# Log\n\nEdited.\n");
		const seen = yield* changesUntil(events, "notes/log.md");
		expect(JSON.stringify(seen)).not.toContain(".hidden/x.md");
		yield* events.close();
	});
});
