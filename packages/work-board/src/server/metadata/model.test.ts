import { expect, it } from "vitest";
import { identityUrl, referenceTarget } from "./links.ts";
import { metadataModel } from "./model.ts";
import { metadataParse } from "./parse.ts";

function document(file: string, yaml: string) {
	return { file, parsed: metadataParse(`---\n${yaml}\n---\n# Prose`) };
}

it("resolves explicit item and criterion references without inferring missing state", () => {
	const target = document("task.md", "id: work.search\ncriteria:\n  - id: keyboard\n    text: Return focus");
	const source = document(
		"decision.md",
		"id: decision.search\nrelationships:\n  - kind: informs\n    target: work.search#keyboard\nitems: [work.search]",
	);
	const model = metadataModel([target, source]);
	expect(model.diagnostics.get("decision.md")).toEqual([]);
	expect(referenceTarget("work.search#keyboard", model)).toBe(`${identityUrl("work.search")}#criterion-keyboard`);
	expect(target.parsed.fields.status).toBeUndefined();
	expect(target.parsed.fields.owner).toBeUndefined();
});

it("diagnoses every duplicate source and refuses to pick an identity or criterion winner", () => {
	const first = document("a.md", "id: work.same");
	const second = document("b.md", "id: work.same");
	const source = document("source.md", "relationships:\n  - kind: depends_on\n    target: work.same\n  - kind: informs\n    target: missing.id");
	const model = metadataModel([first, second, source]);
	for (const file of ["a.md", "b.md"]) {
		expect(model.diagnostics.get(file)?.[0]?.message).toContain("a.md, b.md");
	}
	expect(model.diagnostics.get("source.md")?.map((problem) => problem.message)).toEqual([
		"Ambiguous reference work.same; the ID is duplicated.",
		"Unresolved reference missing.id.",
	]);
	expect(referenceTarget("work.same", model)).toBeUndefined();
	const duplicated = metadataModel([
		document("criterion.md", "id: work.criteria\ncriteria:\n  - id: same\n    text: First\n  - id: same\n    text: Second"),
	]);
	expect(referenceTarget("work.criteria#same", duplicated)).toBeUndefined();
	expect(duplicated.diagnostics.get("criterion.md")?.[0]?.message).toContain("Duplicate criterion");
});

it("does not assert unresolved references or uniqueness from an incomplete workspace", () => {
	const source = document("readable.md", "id: work.source\nrelationships:\n  - kind: informs\n    target: unreadable.id");
	const model = metadataModel([source], ["unreadable.md"]);
	expect(model.diagnostics.get("readable.md")?.map((problem) => problem.message)).toEqual([
		"Workspace index incomplete; could not read unreadable.md. Identity and references cannot be validated completely.",
	]);
	expect(referenceTarget("work.source", model)).toBeUndefined();
});
