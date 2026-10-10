import { expect, it } from "vitest";
import { metadataParse } from "#metadata/parse.ts";

it("treats an empty frontmatter header as optional metadata without losing its prose", () => {
	const source = "---\n---\n# Plain\n";
	expect(metadataParse(source)).toEqual({ body: "# Plain\n", bodyLine: 3, diagnostics: [], fields: {}, lines: {}, raw: "---\n---\n" });
});

it("keeps a frontmatter-only document ending at its closing delimiter intact", () => {
	const parsed = metadataParse("---\nid: item.edge\n---");
	expect(parsed.fields).toEqual({ id: "item.edge" });
	expect(parsed.body).toBe("");
	expect(parsed.raw).toBe("---\nid: item.edge\n---");
});

it("discloses non-string YAML keys while retaining independent valid work identity", () => {
	const parsed = metadataParse("---\n7: unexpected\nid: item.edge\n---\n# Readable");
	expect(parsed.fields).toEqual({ id: "item.edge" });
	expect(parsed.body).toBe("# Readable");
	expect(parsed.lines).toEqual({ id: 3 });
	expect(parsed.diagnostics).toEqual([{ field: "7", line: 2, message: "Unknown field 7; kept in the original frontmatter." }]);
});
