import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { indexedBriefs, watchedIndexStory } from "#test/watchedIndexStory.ts";

const BRIEF = "---\nid: brief\nkind: task\n---\n# Before";
const project = [indexedBriefs({ "brief.md": BRIEF, "unchanged.md": "# Unchanged" })];

watchedIndexStory.it("editing a brief updates its metadata and emits one change without touching unchanged files", project, function* (board) {
	expect((yield* board.read()).documents[0]?.parsed.body).toBe("# Before");
	board.clearAccesses();

	board.edit("brief.md", BRIEF.replace("Before", "After"));
	yield* board.notify(["brief.md"]);

	const changes = yield* board.changeEvents();
	yield* outcomes({
		"edited body": [board.read().pipe(Effect.map((snapshot) => snapshot.documents[0]?.parsed.body)), "# After"],
		"files read": [Effect.sync(board.readFiles), ["brief.md"]],
		"folders scanned": [Effect.sync(board.scannedFolders), []],
		"one change": [Effect.succeed(changes), [{ _tag: "Changed", paths: ["brief.md"], sequence: expect.any(Number) }]],
	});
});

watchedIndexStory.it("adding a brief indexes its identity and emits one change without scanning the folder", project, function* (board) {
	expect((yield* board.read()).model.ids.has("added")).toBe(false);
	board.clearAccesses();

	board.add("added.md", "---\nid: added\n---\n# Added");
	yield* board.notify(["added.md"]);

	const changes = yield* board.changeEvents();
	yield* outcomes({
		"files read": [Effect.sync(board.readFiles), ["added.md"]],
		"folders scanned": [Effect.sync(board.scannedFolders), []],
		"new identity": [board.read().pipe(Effect.map((snapshot) => snapshot.model.ids.get("added")?.[0]?.file)), "added.md"],
		"one change": [Effect.succeed(changes), [{ _tag: "Changed", paths: ["added.md"], sequence: expect.any(Number) }]],
	});
});

watchedIndexStory.it("moving a brief replaces its indexed path and emits one change", project, function* (board) {
	expect((yield* board.read()).model.ids.get("brief")?.map((document) => document.file)).toEqual(["brief.md"]);
	board.clearAccesses();

	board.move("brief.md", "moved.md");
	yield* board.notify(["brief.md", "moved.md"]);

	const changes = yield* board.changeEvents();
	yield* outcomes({
		"files read": [Effect.sync(board.readFiles), ["moved.md"]],
		"moved identity": [board.read().pipe(Effect.map((snapshot) => snapshot.model.ids.get("brief")?.map((document) => document.file))), ["moved.md"]],
		"one change": [
			Effect.succeed(changes),
			[{ _tag: "Changed", paths: expect.arrayContaining(["brief.md", "moved.md"]), sequence: expect.any(Number) }],
		],
	});
});

watchedIndexStory.it("deleting a brief removes its identity and emits one change without rereading other files", project, function* (board) {
	expect((yield* board.read()).model.ids.has("brief")).toBe(true);
	board.clearAccesses();

	board.remove("brief.md");
	yield* board.notify(["brief.md"]);

	const changes = yield* board.changeEvents();
	yield* outcomes({
		"files read": [Effect.sync(board.readFiles), []],
		"one change": [Effect.succeed(changes), [{ _tag: "Changed", paths: ["brief.md"], sequence: expect.any(Number) }]],
		"removed identity": [board.read().pipe(Effect.map((snapshot) => snapshot.model.ids.has("brief"))), false],
	});
});

watchedIndexStory.it("the full check repairs an edit the watcher missed even with its timestamp preserved", project, function* (board) {
	expect((yield* board.read()).documents[0]?.parsed.body).toBe("# Before");

	board.edit("brief.md", BRIEF.replace("Before", "Missed"));
	yield* board.checkPasses();

	yield* outcomes({
		"repair change": [board.changeEvents(), [{ _tag: "Changed", paths: ["brief.md"], sequence: expect.any(Number) }]],
		"repaired body": [board.read().pipe(Effect.map((snapshot) => snapshot.documents[0]?.parsed.body)), "# Missed"],
	});
});

watchedIndexStory.it("reads after startup touch no unchanged files or directories", project, function* (board) {
	const first = yield* board.read();
	board.clearAccesses();

	const next = yield* board.read();

	expect(next).toBe(first);
	expect(board.readFiles()).toEqual([]);
	expect(board.scannedFolders()).toEqual([]);
});
