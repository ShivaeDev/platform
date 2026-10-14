import { expect, it } from "vitest";
import { metadataModel } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { currentDocument } from "./currentDocument.ts";

function snapshot(source: string): Snapshot {
	const documents = [{ file: "note.md", links: ["other.md"], parsed: metadataParse(source) }];
	return { documents, entries: [], model: metadataModel(documents), modified: new Map(), revision: 0, unavailable: [] };
}

it.each([
	"# Plain note\n",
	"---\nid: note\n---\n# Note\n",
	"\uFEFF---\r\nid: note\r\n---\r\n# Note\r\n",
	"---\nid: [broken\n---\n# Note\n",
	"---\nid: note\n# Unterminated\n",
])("reuses the indexed document and model only for the exact source bytes: %s", (source) => {
	const indexed = snapshot(source);
	const current = currentDocument(indexed, "note.md", source);
	expect(current.snapshot).toBe(indexed);
	expect(current.document).toBe(indexed.documents[0]);
	expect(current.document.links).toEqual(["other.md"]);
	const edited = currentDocument(indexed, "note.md", `${source}\nChanged before watcher notification.`);
	expect(edited.snapshot).not.toBe(indexed);
	expect(edited.document.parsed.body).toContain("Changed before watcher notification.");
});

it("revalidates identity and dependent diagnostics when the selected source changes before the index", () => {
	const indexed = snapshot("---\nid: original\nrelationships:\n - kind: informs\n   target: original\n---\n# Note");
	const dependent = {
		file: "other.md",
		parsed: metadataParse("---\nid: other\nrelationships:\n - kind: informs\n   target: original\n---\n# Other"),
	};
	const documents = [...indexed.documents, dependent];
	const original = { ...indexed, documents, model: metadataModel(documents) };
	const current = currentDocument(original, "note.md", "---\nid: other\n---\n# Changed", "note.md");
	expect(current.snapshot.model.ids.has("original")).toBe(false);
	expect(current.snapshot.model.ids.get("other")).toHaveLength(2);
	expect(current.snapshot.model.diagnostics.get("other.md")).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ message: expect.stringContaining("Duplicate ID other") }),
			expect.objectContaining({ message: "Unresolved reference original." }),
		]),
	);
	expect(original.model.ids.get("original")).toHaveLength(1);
});
