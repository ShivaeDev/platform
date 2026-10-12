import { expect, it } from "vitest";
import { metadataModel } from "./model.ts";
import { metadataParse } from "./parse.ts";
import { referenceFile, sourceFile, sourceHref } from "./sourceLinks.ts";

it("resolves nested/encoded Markdown and root routes without treating external or executable sources as local", () => {
	const model = metadataModel([], [], "nested/home.md");
	expect(sourceFile("../evidence%20%26%20review.md#heading-one", "nested/result.md", model)).toBe("evidence & review.md");
	expect(sourceFile("/", "nested/result.md", model)).toBe("nested/home.md");
	expect(sourceFile("https://example.com/evidence.md", "result.md", model)).toBeUndefined();
	expect(sourceFile("http://work-board.local/evidence.md", "result.md", model)).toBeUndefined();
	expect(sourceHref("javascript:alert(1)", "result.md")).toBeUndefined();
	expect(sourceFile("/%E0%A4%A.md", "result.md", model)).toBeUndefined();
});

it("resolves stable source URLs without confusing a .md ID with a Markdown path or choosing duplicate IDs", () => {
	const first = { file: "actual.md", parsed: metadataParse("---\nid: source.md\n---\n# Source") };
	const model = metadataModel([first]);
	expect(sourceFile("/_board/item/source.md/", "result.md", model)).toBe("actual.md");
	expect(sourceFile("/_board/item/source.md", "result.md", model)).toBe("_board/item/source.md");
	expect(referenceFile("source.md", metadataModel([first, { ...first, file: "other.md" }]))).toBeUndefined();
	expect(referenceFile("source.md", metadataModel([first], ["unreadable.md"]))).toBeUndefined();
});
