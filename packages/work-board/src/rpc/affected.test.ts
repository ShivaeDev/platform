import { expect, it } from "vitest";
import { type MetadataDocument, metadataModel } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import { affected } from "./affected.ts";
import { documents, identities, index, navigation } from "./keys.ts";

function document(file: string, source: string, links: readonly string[] = []): MetadataDocument {
	return { file, links, parsed: metadataParse(source) };
}
function task(id: string, fields = "", body = "Task") {
	return `---\nid: ${id}\n${fields}---\n${body}`;
}

it("invalidates former and current dependencies, root aliases and stable identities while leaving unrelated documents alone", () => {
	const home = document("nested/home.md", task("home", "relationships:\n - kind: informs\n   target: old\n"));
	const old = document("old.md", task("old"));
	const next = document("new.md", task("new"));
	const unrelated = document("other.md", "Unrelated");
	const before = metadataModel([home, old, next, unrelated], [], home.file);
	const after = metadataModel(
		[document(home.file, task("renamed", "relationships:\n - kind: informs\n   target: new\n")), old, next, unrelated],
		[],
		home.file,
	);
	const keys = affected(before, after, [home.file]);
	expect(keys).toEqual(
		expect.arrayContaining([
			index.list,
			navigation.list,
			documents.item(""),
			documents.item(home.file),
			documents.item(old.file),
			documents.item(next.file),
			identities.item("home"),
			identities.item("renamed"),
		]),
	);
	expect(keys).not.toContainEqual(documents.item(unrelated.file));
});

it("follows board membership, criterion evidence, attention targets and ordinary Markdown links", () => {
	const docs = [
		document("board.md", task("board", "items: [task]\n")),
		document("task.md", task("task", "criteria:\n - id: done\n   text: Complete\n")),
		document("result.md", task("result", "evidence:\n - source: source.md\n   criterion: task#done\n")),
		document("source.md", "Source"),
		document(
			"request.md",
			task(
				"request",
				"attention:\n - id: review\n   kind: review\n   state: open\n   response_from: [maintainer]\n   reason: Read this\n   unblocks: [task#done]\n",
			),
		),
		document("note.md", "Read source", ["source.md"]),
	];
	const model = metadataModel(docs);
	expect(affected(model, model, ["source.md"])).toEqual(expect.arrayContaining(docs.map((doc) => documents.item(doc.file))));
});

it("reconciles fully for incomplete indexes, unknown paths or edits observed outside the announced change", () => {
	const a = document("a.md", "A");
	const b = document("b.md", "B");
	const before = metadataModel([a, b]);
	expect(affected(before, metadataModel([a, b], ["failed.md"]), [a.file])).toBeUndefined();
	expect(affected(before, before, ["unknown.md"])).toBeUndefined();
	expect(affected(before, metadataModel([a, document(b.file, "Changed during index read")]), [a.file])).toBeUndefined();
});

it("updates every conflicting stable-ID projection when a duplicate is added or removed", () => {
	const first = document("first.md", task("same"));
	const duplicate = document("duplicate.md", task("same"));
	const before = metadataModel([first]);
	const after = metadataModel([first, duplicate]);
	expect(affected(before, after, [duplicate.file])).toEqual(expect.arrayContaining([identities.item("same"), documents.item(first.file)]));
	expect(affected(after, before, [duplicate.file])).toEqual(expect.arrayContaining([identities.item("same"), documents.item(first.file)]));
});
