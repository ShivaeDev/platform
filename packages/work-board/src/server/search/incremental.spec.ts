import { renameSync, statSync, unlinkSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { type Effect, Ref } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { inboxItems } from "#server/attention/inbox.ts";
import { type Folder, folder } from "#test/board.ts";
import { incrementalIndex } from "#test/incrementalIndex.ts";
import { indexState } from "#test/indexState.ts";
import { searchMatch } from "./match.ts";

let notes: Folder;
let index: Effect.Success<ReturnType<typeof incrementalIndex>>;

afterEach(() => {
	notes?.remove();
});

it.live("reads and parses only the edited or added file, removes deleted records and reindexes renamed paths", function* () {
	notes = folder({ "a.md": "---\nid: a\n---\n# Alpha", "b.md": "---\nid: b\n---\n# Beta", "c.md": "# Gamma" });
	index = yield* incrementalIndex(notes.root);
	const before = yield* index.read();
	const timestamp = statSync(join(notes.root, "a.md"));
	notes.write("a.md", "---\nid: a\n---\n# Changed");
	utimesSync(join(notes.root, "a.md"), timestamp.atime, timestamp.mtime);
	yield* index.update(["a.md"]);
	const edited = yield* index.read();
	expect(index.reads).toEqual([join(notes.root, "a.md")]);
	expect(edited.documents[1]).toBe(before.documents[1]);
	expect(edited.model.ids.get("b")).toBe(before.model.ids.get("b"));
	expect(edited.model.diagnostics.get("b.md")).toBe(before.model.diagnostics.get("b.md"));
	expect(edited.entries.find((entry) => entry.file === "b.md")).toBe(before.entries.find((entry) => entry.file === "b.md"));
	notes.write("added.md", "# Added");
	yield* index.update(["added.md"]);
	yield* index.read();
	expect(index.reads).toEqual([join(notes.root, "added.md")]);
	unlinkSync(join(notes.root, "added.md"));
	yield* index.update(["added.md"]);
	yield* index.read();
	expect(index.reads).toEqual([]);
	renameSync(join(notes.root, "a.md"), join(notes.root, "moved.md"));
	yield* index.update(["a.md", "moved.md"]);
	const moved = yield* index.read();
	expect(index.reads).toEqual([join(notes.root, "moved.md")]);
	expect(indexState(moved)).toEqual(indexState(yield* index.fresh()));
});

it.live(
	"checks bytes during reconciliation without reparsing unchanged files, retries unavailable sources and catches edits with preserved timestamps",
	function* () {
		notes = folder({ "a.md": "---\nid: a\n---\n# Alpha", "b.md": "---\nid: b\n---\n# Beta" });
		index = yield* incrementalIndex(notes.root);
		const before = yield* index.read();
		const timestamp = statSync(join(notes.root, "a.md"));
		notes.write("a.md", "---\nid: b\n---\n# Changed");
		utimesSync(join(notes.root, "a.md"), timestamp.atime, timestamp.mtime);
		yield* index.update();
		const reconciled = yield* index.read();
		expect(reconciled.documents[1]).toBe(before.documents[1]);
		expect(indexState(reconciled)).toEqual(indexState(yield* index.fresh()));
		index.blocked.add(join(notes.root, "a.md"));
		yield* index.update(["a.md"]);
		const incomplete = yield* index.read();
		expect(incomplete.unavailable).toEqual(["a.md"]);
		expect(indexState(incomplete)).toEqual(indexState(yield* index.fresh()));
		index.blocked.clear();
		index.reads.length = 0;
		const recovered = yield* index.read();
		expect(index.reads).toEqual([join(notes.root, "a.md")]);
		expect(indexState(recovered)).toEqual(indexState(yield* index.fresh()));
		yield* Ref.set(index.changes.watching, false);
		notes.write("b.md", "# Offline edit");
		const offline = yield* index.read();
		expect(indexState(offline)).toEqual(indexState(yield* index.fresh()));
	},
);

it.live("carries source modification times into Inbox order and age while retaining unchanged document identity", function* () {
	function source(id: string) {
		return `---\nid: ${id}\nkind: question\nstatus: open\n---\n# ${id}`;
	}
	notes = folder({ "a.md": source("a"), "b.md": source("b") });
	utimesSync(join(notes.root, "a.md"), 1, 1);
	utimesSync(join(notes.root, "b.md"), 2, 2);
	index = yield* incrementalIndex(notes.root);
	const before = yield* index.read();
	expect(inboxItems(before).map((item) => item.id)).toEqual(["a", "b"]);
	expect(searchMatch(before.entries, "question", before.modified).results.map((entry) => entry.id)).toEqual(["b", "a"]);
	notes.write("a.md", `${source("a")}\nChanged context`);
	utimesSync(join(notes.root, "a.md"), 10, 10);
	yield* index.update(["a.md"]);
	const edited = yield* index.read();
	expect(inboxItems(edited).map((item) => item.id)).toEqual(["b", "a"]);
	expect(searchMatch(edited.entries, "question", edited.modified).results.map((entry) => entry.id)).toEqual(["a", "b"]);
	expect(edited.documents[0]?.modified).toBe(10_000);
	expect(edited.documents[1]).toBe(before.documents[1]);
	expect(edited.model.ids.get("b")).toBe(before.model.ids.get("b"));
	utimesSync(join(notes.root, "b.md"), 2 * 86_400, 2 * 86_400);
	yield* index.update(["b.md"]);
	const unchanged = yield* index.read();
	expect(unchanged.documents[1]).toBe(edited.documents[1]);
	expect(unchanged.model.ids.get("b")).toBe(edited.model.ids.get("b"));
	expect(unchanged.documents[1]?.modified).toBe(2000);
	expect(inboxItems(unchanged).map((item) => item.id)).toEqual(["a", "b"]);
	expect(searchMatch(unchanged.entries, "question", unchanged.modified).results.map((entry) => entry.id)).toEqual(["b", "a"]);
	utimesSync(join(notes.root, "a.md"), 3 * 86_400, 3 * 86_400);
	yield* index.update();
	const reconciled = yield* index.read();
	expect(reconciled.documents[0]).toBe(unchanged.documents[0]);
	expect(inboxItems(reconciled).map((item) => item.id)).toEqual(["b", "a"]);
	expect(searchMatch(reconciled.entries, "question", reconciled.modified).results.map((entry) => entry.id)).toEqual(["a", "b"]);
});
