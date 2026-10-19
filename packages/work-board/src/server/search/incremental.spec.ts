import { join } from "node:path";
import { expect } from "vitest";
import { inboxItems } from "#server/attention/inbox.ts";
import { indexedQuestion } from "#test/indexedQuestion.ts";
import { indexState } from "#test/indexState.ts";
import { indexedFiles, indexStory } from "#test/indexStory.ts";
import { searchMatch } from "./match.ts";

indexStory.it(
	"reads and parses only the edited or added file, removes deleted records and reindexes renamed paths",
	[indexedFiles({ "a.md": "---\nid: a\n---\n# Alpha", "b.md": "---\nid: b\n---\n# Beta", "c.md": "# Gamma" })],
	function* ({ readIndex, freshIndex, invalidate, writeFile, removeFile, moveFile, timestamp, setTimestamp, readPaths, root }) {
		const before = yield* readIndex();
		const originalTime = timestamp("a.md");
		writeFile("a.md", "---\nid: a\n---\n# Changed");
		setTimestamp("a.md", originalTime.atime, originalTime.mtime);
		yield* invalidate(["a.md"]);
		const edited = yield* readIndex();
		expect(readPaths()).toEqual([join(root, "a.md")]);
		expect(edited.documents[1]).toBe(before.documents[1]);
		expect(edited.model.ids.get("b")).toBe(before.model.ids.get("b"));
		expect(edited.model.diagnostics.get("b.md")).toBe(before.model.diagnostics.get("b.md"));
		expect(edited.entries.find((entry) => entry.file === "b.md")).toBe(before.entries.find((entry) => entry.file === "b.md"));
		writeFile("added.md", "# Added");
		yield* invalidate(["added.md"]);
		yield* readIndex();
		expect(readPaths()).toEqual([join(root, "added.md")]);
		removeFile("added.md");
		yield* invalidate(["added.md"]);
		yield* readIndex();
		expect(readPaths()).toEqual([]);
		moveFile("a.md", "moved.md");
		yield* invalidate(["a.md", "moved.md"]);
		const moved = yield* readIndex();
		expect(readPaths()).toEqual([join(root, "moved.md")]);
		expect(indexState(moved)).toEqual(indexState(yield* freshIndex()));
	},
);

indexStory.it(
	"checks bytes during reconciliation without reparsing unchanged files, retries unavailable sources and catches edits with preserved timestamps",
	[indexedFiles({ "a.md": "---\nid: a\n---\n# Alpha", "b.md": "---\nid: b\n---\n# Beta" })],
	function* ({ readIndex, freshIndex, invalidate, writeFile, timestamp, setTimestamp, blockFile, restoreFiles, stopWatching, readPaths, root }) {
		const before = yield* readIndex();
		const originalTime = timestamp("a.md");
		writeFile("a.md", "---\nid: b\n---\n# Changed");
		setTimestamp("a.md", originalTime.atime, originalTime.mtime);
		yield* invalidate();
		const reconciled = yield* readIndex();
		expect(reconciled.documents[1]).toBe(before.documents[1]);
		expect(indexState(reconciled)).toEqual(indexState(yield* freshIndex()));
		blockFile("a.md");
		yield* invalidate(["a.md"]);
		const incomplete = yield* readIndex();
		expect(incomplete.unavailable).toEqual(["a.md"]);
		expect(indexState(incomplete)).toEqual(indexState(yield* freshIndex()));
		restoreFiles();
		const recovered = yield* readIndex();
		expect(readPaths()).toEqual([join(root, "a.md")]);
		expect(indexState(recovered)).toEqual(indexState(yield* freshIndex()));
		yield* stopWatching();
		writeFile("b.md", "# Offline edit");
		const offline = yield* readIndex();
		expect(indexState(offline)).toEqual(indexState(yield* freshIndex()));
	},
);

indexStory.it(
	"carries source modification times into Inbox order and age while retaining unchanged document identity",
	[
		indexedFiles(
			{ "a.md": indexedQuestion("a"), "b.md": indexedQuestion("b") },
			new Map([
				["a.md", 1000],
				["b.md", 2000],
			]),
		),
	],
	function* ({ readIndex, invalidate, writeFile, setTimestamp }) {
		const before = yield* readIndex();
		expect(inboxItems(before).map((item) => item.id)).toEqual(["a", "b"]);
		expect(searchMatch(before.entries, "question", before.modified).results.map((entry) => entry.id)).toEqual(["b", "a"]);
		writeFile("a.md", `${indexedQuestion("a")}\nChanged context`);
		setTimestamp("a.md", 10, 10);
		yield* invalidate(["a.md"]);
		const edited = yield* readIndex();
		expect(inboxItems(edited).map((item) => item.id)).toEqual(["b", "a"]);
		expect(searchMatch(edited.entries, "question", edited.modified).results.map((entry) => entry.id)).toEqual(["a", "b"]);
		expect(edited.documents[0]?.modified).toBe(10_000);
		expect(edited.documents[1]).toBe(before.documents[1]);
		expect(edited.model.ids.get("b")).toBe(before.model.ids.get("b"));
		setTimestamp("b.md", 2 * 86_400, 2 * 86_400);
		yield* invalidate(["b.md"]);
		const unchanged = yield* readIndex();
		expect(unchanged.documents[1]).toBe(edited.documents[1]);
		expect(unchanged.model.ids.get("b")).toBe(edited.model.ids.get("b"));
		expect(unchanged.documents[1]?.modified).toBe(2000);
		expect(inboxItems(unchanged).map((item) => item.id)).toEqual(["a", "b"]);
		expect(searchMatch(unchanged.entries, "question", unchanged.modified).results.map((entry) => entry.id)).toEqual(["b", "a"]);
		setTimestamp("a.md", 3 * 86_400, 3 * 86_400);
		yield* invalidate();
		const reconciled = yield* readIndex();
		expect(reconciled.documents[0]).toBe(unchanged.documents[0]);
		expect(inboxItems(reconciled).map((item) => item.id)).toEqual(["b", "a"]);
		expect(searchMatch(reconciled.entries, "question", reconciled.modified).results.map((entry) => entry.id)).toEqual(["a", "b"]);
	},
);
