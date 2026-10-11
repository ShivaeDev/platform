import { renameSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { faultyWatch } from "#test/faults.ts";
import { changesUntil, type EventStream, rpcSearch, rpcWatcher, subscribe } from "#test/nativeRpc.ts";

let workspace: Folder;
let reference: Folder;
let replacement: Folder;
let board: RunningBoard;

const setupBoard = Effect.gen(function* () {
	workspace = folder({ "plan.md": "# Plan\n" });
	reference = folder({
		".drafts/private.md": "# Hidden draft\n",
		"guide/next.md": "# Next reference\n\n[Start](start.md#evidence)\n",
		"guide/start.md": "# Reference guide\n\n[Next](next.md)\n\n## Evidence\n\nReference passage.\n",
		"node_modules/secret.md": "# Dependency\n",
	});
	replacement = folder({ "guide/start.md": "# Replacement guide\n" });
	symlinkSync(reference.root, join(workspace.root, "reference"));
	board = yield* startBoard(workspace.root, "plan.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	workspace.remove();
	reference.remove();
	replacement.remove();
});

function get(path: string) {
	return fetch(`${board.url}${path}`);
}

const ready = Effect.fn("Test.ready")(function* (events: EventStream) {
	for (;;) {
		yield* events.next();
		if ((yield* rpcWatcher(board)).watching) {
			return;
		}
	}
});

effectApp("reads linked reference Markdown with logical links, search, aliases and cycle protection", function* () {
	yield* board.stop();
	symlinkSync(reference.root, join(workspace.root, "second-reference"));
	symlinkSync(reference.root, join(reference.root, "guide/loop"));
	symlinkSync(workspace.root, join(reference.root, "workspace-loop"));
	symlinkSync("missing-folder", join(workspace.root, "broken"));
	board = yield* startBoard(workspace.root, "plan.md");
	const html = yield* Effect.promise(async () => (await get("/reference/guide/start.md")).text());
	expect(html).toContain("Reference guide");
	expect(html).toContain('href="/reference/guide/next.md"');
	expect(html).toContain('href="/second-reference/guide/start.md"');
	expect(html).not.toContain("/loop/");
	expect(html).not.toContain("workspace-loop/");
	expect(html).not.toContain("private.md");
	expect(html).not.toContain("secret.md");
	for (const path of [
		"/reference/.drafts/private.md",
		"/reference/node_modules/secret.md",
		"/reference/guide/loop/guide/start.md",
		"/reference/../guide/start.md",
	]) {
		expect((yield* Effect.promise(() => get(path))).status).toBe(404);
	}
	const search = JSON.stringify(yield* rpcSearch(board, "Reference passage"));
	expect(search).toContain("reference/guide/start.md");
	expect(search).toContain("second-reference/guide/start.md");
});

effectApp("selects the requested linked nested home at / and resolves its relative links", function* () {
	yield* board.stop();
	symlinkSync(reference.root, join(workspace.root, "a-reference"));
	board = yield* startBoard(workspace.root, "reference/guide/start.md");
	const html = yield* Effect.promise(async () => (await get("/")).text());
	expect(html).toContain('href="/reference/guide/start.md" aria-current="page"');
	expect(html).toContain('href="/reference/guide/next.md"');
	expect(html).not.toContain('href="/a-reference/guide/start.md" aria-current="page"');
});

effectApp("watches external edits, additions, renames and removals using workspace-relative paths", function* () {
	const events = yield* subscribe(board);
	try {
		yield* ready(events);
		yield* rpcSearch(board, "Reference passage");
		reference.write("guide/start.md", "# Reference guide\n\nUpdated linked passage.\n");
		yield* changesUntil(events, "reference/guide/start.md");
		expect(yield* Effect.promise(async () => (await get("/reference/guide/start.md")).text())).toContain("Updated linked passage");
		expect(JSON.stringify(yield* rpcSearch(board, "Updated linked passage"))).toContain("reference/guide/start.md");
		expect((yield* rpcSearch(board, "Reference passage")).total).toBe(0);
		reference.write("guide/added.md", "# Added reference\n");
		yield* changesUntil(events, "reference/guide/added.md");
		expect((yield* Effect.promise(() => get("/reference/guide/added.md"))).status).toBe(200);
		renameSync(join(reference.root, "guide/added.md"), join(reference.root, "guide/moved.md"));
		yield* changesUntil(events, "reference/guide/moved.md");
		expect((yield* Effect.promise(() => get("/reference/guide/added.md"))).status).toBe(404);
		expect((yield* Effect.promise(() => get("/reference/guide/moved.md"))).status).toBe(200);
		rmSync(join(reference.root, "guide/moved.md"));
		yield* changesUntil(events, "reference/guide/moved.md");
		expect((yield* Effect.promise(() => get("/reference/guide/moved.md"))).status).toBe(404);
	} finally {
		yield* events.close();
	}
});

effectApp("discovers newly linked folders and retargeted links without restarting the server", function* () {
	const events = yield* subscribe(board);
	try {
		yield* ready(events);
		symlinkSync(replacement.root, join(workspace.root, "new-reference"));
		yield* ready(events);
		expect(yield* Effect.promise(async () => (await get("/new-reference/guide/start.md")).text())).toContain("Replacement guide");
		replacement.write("guide/start.md", "# New live replacement\n");
		yield* changesUntil(events, "new-reference/guide/start.md");
		rmSync(join(workspace.root, "reference"));
		symlinkSync(replacement.root, join(workspace.root, "reference"));
		yield* ready(events);
		expect(yield* Effect.promise(async () => (await get("/reference/guide/start.md")).text())).toContain("New live replacement");
		expect((yield* Effect.promise(() => get("/reference/guide/next.md"))).status).toBe(404);
		replacement.write("guide/start.md", "# Retargeted live reference\n");
		yield* changesUntil(events, "reference/guide/start.md");
		expect(JSON.stringify(yield* rpcSearch(board, "Retargeted live reference"))).toContain("reference/guide/start.md");
	} finally {
		yield* events.close();
	}
});

effectApp("keeps escaping file links outside an explicitly included reference directory unreadable", function* () {
	yield* board.stop();
	symlinkSync(join(replacement.root, "guide/start.md"), join(reference.root, "guide/leak.md"));
	board = yield* startBoard(workspace.root, "plan.md");
	expect((yield* Effect.promise(() => get("/reference/guide/leak.md"))).status).toBe(404);
	expect(yield* Effect.promise(async () => (await get("/")).text())).not.toContain("leak.md");
	expect((yield* rpcSearch(board, "Replacement guide")).total).toBe(0);
});

effectApp("discloses a failed linked watch and catches up its index after recovery", function* () {
	yield* board.stop();
	const fault = faultyWatch();
	board = yield* startBoard(workspace.root, "plan.md", fault.wrap);
	const events = yield* subscribe(board);
	try {
		yield* ready(events);
		yield* rpcSearch(board, "Reference passage");
		yield* fault.fail();
		yield* events.next();
		while ((yield* rpcWatcher(board)).watching) {
			yield* events.next();
		}
		reference.write("guide/start.md", "# Updated while watching unavailable\n");
		expect((yield* rpcSearch(board, "watching unavailable")).total).toBeGreaterThan(0);
		fault.heal();
		yield* ready(events);
		expect((yield* rpcSearch(board, "Reference passage")).total).toBe(0);
	} finally {
		yield* events.close();
	}
});

effectApp("retains internal directory aliases alongside their original paths and watches their retargeting", function* () {
	yield* board.stop();
	rmSync(join(workspace.root, "reference"));
	workspace.write("notes/start.md", "# Original internal note\n");
	workspace.write("other/start.md", "# Other internal note\n");
	symlinkSync("notes", join(workspace.root, "alias"));
	board = yield* startBoard(workspace.root, "plan.md");
	const html = yield* Effect.promise(async () => (await get("/")).text());
	expect(html).toContain('href="/notes/start.md"');
	expect(html).toContain('href="/alias/start.md"');
	const events = yield* subscribe(board);
	try {
		yield* ready(events);
		rmSync(join(workspace.root, "alias"));
		symlinkSync("other", join(workspace.root, "alias"));
		yield* ready(events);
		expect(yield* Effect.promise(async () => (await get("/alias/start.md")).text())).toContain("Other internal note");
		workspace.write("other/start.md", "# Updated internal note\n");
		yield* changesUntil(events, "alias/start.md");
		expect(yield* Effect.promise(async () => (await get("/alias/start.md")).text())).toContain("Updated internal note");
	} finally {
		yield* events.close();
	}
});
