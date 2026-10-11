import { renameSync, statSync, unlinkSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { Effect, Ref } from "effect";
import { afterEach, expect, it } from "vitest";
import { inboxItems } from "#attention/inbox.ts";
import { inboxHtml } from "#attention/inboxHtml.ts";
import { type Folder, folder } from "#test/board.ts";
import { incrementalIndex } from "#test/incrementalIndex.ts";
import { indexState } from "#test/indexState.ts";

let notes: Folder;
let index: Awaited<ReturnType<typeof incrementalIndex>>;
afterEach(async () => {
	await index?.close();
	notes?.remove();
});

it("reads and parses only the edited or added file, removes deleted records and reindexes renamed paths", async () => {
	notes = folder({ "a.md": "---\nid: a\n---\n# Alpha", "b.md": "---\nid: b\n---\n# Beta", "c.md": "# Gamma" });
	index = await incrementalIndex(notes.root);
	const before = await index.read();
	const timestamp = statSync(join(notes.root, "a.md"));
	notes.write("a.md", "---\nid: a\n---\n# Changed");
	utimesSync(join(notes.root, "a.md"), timestamp.atime, timestamp.mtime);
	index.update(["a.md"]);
	const edited = await index.read();
	expect(index.reads).toEqual([join(notes.root, "a.md")]);
	expect(edited.documents[1]).toBe(before.documents[1]);
	expect(edited.model.ids.get("b")).toBe(before.model.ids.get("b"));
	expect(edited.model.diagnostics.get("b.md")).toBe(before.model.diagnostics.get("b.md"));
	expect(edited.entries.find((entry) => entry.file === "b.md")).toBe(before.entries.find((entry) => entry.file === "b.md"));
	notes.write("added.md", "# Added");
	index.update(["added.md"]);
	await index.read();
	expect(index.reads).toEqual([join(notes.root, "added.md")]);
	unlinkSync(join(notes.root, "added.md"));
	index.update(["added.md"]);
	await index.read();
	expect(index.reads).toEqual([]);
	renameSync(join(notes.root, "a.md"), join(notes.root, "moved.md"));
	index.update(["a.md", "moved.md"]);
	const moved = await index.read();
	expect(index.reads).toEqual([join(notes.root, "moved.md")]);
	expect(indexState(moved)).toEqual(indexState(await index.fresh()));
});

it("checks bytes during reconciliation without reparsing unchanged files, retries unavailable sources and catches edits with preserved timestamps", async () => {
	notes = folder({ "a.md": "---\nid: a\n---\n# Alpha", "b.md": "---\nid: b\n---\n# Beta" });
	index = await incrementalIndex(notes.root);
	const before = await index.read();
	const timestamp = statSync(join(notes.root, "a.md"));
	notes.write("a.md", "---\nid: b\n---\n# Changed");
	utimesSync(join(notes.root, "a.md"), timestamp.atime, timestamp.mtime);
	index.update();
	const reconciled = await index.read();
	expect(reconciled.documents[1]).toBe(before.documents[1]);
	expect(indexState(reconciled)).toEqual(indexState(await index.fresh()));
	index.blocked.add(join(notes.root, "a.md"));
	index.update(["a.md"]);
	const incomplete = await index.read();
	expect(incomplete.unavailable).toEqual(["a.md"]);
	expect(indexState(incomplete)).toEqual(indexState(await index.fresh()));
	index.blocked.clear();
	index.reads.length = 0;
	const recovered = await index.read();
	expect(index.reads).toEqual([join(notes.root, "a.md")]);
	expect(indexState(recovered)).toEqual(indexState(await index.fresh()));
	Effect.runSync(Ref.set(index.changes.watching, false));
	notes.write("b.md", "# Offline edit");
	const offline = await index.read();
	expect(indexState(offline)).toEqual(indexState(await index.fresh()));
});

it("carries source modification times into Inbox order and age while retaining unchanged document identity", async () => {
	function source(id: string) {
		return `---\nid: ${id}\nkind: question\nstatus: open\n---\n# ${id}`;
	}
	notes = folder({ "a.md": source("a"), "b.md": source("b") });
	utimesSync(join(notes.root, "a.md"), 1, 1);
	utimesSync(join(notes.root, "b.md"), 2, 2);
	index = await incrementalIndex(notes.root);
	const before = await index.read();
	expect(inboxItems(before).map((item) => item.id)).toEqual(["a", "b"]);
	expect(inboxHtml(before, false, 3 * 86_400_000)).toContain("updated 3d ago");
	notes.write("a.md", `${source("a")}\nChanged context`);
	utimesSync(join(notes.root, "a.md"), 10, 10);
	index.update(["a.md"]);
	const edited = await index.read();
	expect(inboxItems(edited).map((item) => item.id)).toEqual(["b", "a"]);
	expect(edited.documents[0]?.modified).toBe(10_000);
	expect(edited.documents[1]).toBe(before.documents[1]);
	expect(edited.model.ids.get("b")).toBe(before.model.ids.get("b"));
	utimesSync(join(notes.root, "b.md"), 20, 20);
	index.update();
	const unchanged = await index.read();
	expect(unchanged.documents[1]).toBe(edited.documents[1]);
	expect(unchanged.model.ids.get("b")).toBe(edited.model.ids.get("b"));
	expect(unchanged.documents[1]?.modified).toBe(2000);
});
