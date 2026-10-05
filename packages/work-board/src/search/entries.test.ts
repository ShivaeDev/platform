import { describe, expect, it } from "vitest";
import { entriesOf } from "./entries.ts";
import { searchMatch } from "./match.ts";

describe("search passages", () => {
	it("omits synthetic source lines for board footnotes appended to a rendering fragment", async () => {
		const source = "# Plan\n\n[^proof]: Supporting citation.\n\n## Review\n\n### Item\n\nA claim[^proof].\n";
		const entries = await entriesOf(source, "board.md", true);
		const citations = entries.filter((entry) => entry.text.includes("Supporting citation"));
		expect(citations.length).toBeGreaterThan(0);
		expect(citations.every((entry) => entry.line === undefined)).toBe(true);
		expect(entries.find((entry) => entry.text.startsWith("A claim"))?.line).toBe(9);
	});
	it.each([false, true])("links duplicate headings to the reader's generated anchors (home %s)", async (home) => {
		const entries = await entriesOf("# Plan\n\n## Evidence\n\nA known phrase.\n\n## Evidence\n\nSecond needle.", "plans/c# & more?.md", home);
		expect(entries.find((entry) => entry.text === "Second needle.")?.href).toBe("/plans/c%23%20%26%20more%3F.md#heading-evidence-2");
		expect(searchMatch(entries, "known phrase").results[0]?.kind).toBe("passage");
		expect(searchMatch(entries, "evidence").results.filter((entry) => entry.kind === "heading")).toHaveLength(2);
	});
	it("indexes readable GFM, code, links, and Unicode without searching HTML markup", async () => {
		const entries = await entriesOf(
			"# Ελληνικά\n\nA **bold** [phrase](target.md).\n\n```ts\nconst needle = 1;\n```\n\n| Value |\n| --- |\n| useful |",
			"note.md",
			false,
		);
		expect(searchMatch(entries, "BOLD phrase").results[0]?.snippet).toContain("bold phrase");
		expect(searchMatch(entries, "needle").results[0]?.href).toContain("heading-%CE%B5");
		expect(searchMatch(entries, "useful").total).toBeGreaterThan(0);
		expect(searchMatch(entries, "href").total).toBe(0);
		expect(searchMatch(entries, "ελληνικά").results[0]?.kind).toBe("document");
	});
	it("ranks titles then headings then passages, bounds results, and matches terms deterministically", async () => {
		const entries = await entriesOf(
			`# Needle\n\n## Needle section\n\n${Array.from({ length: 50 }, (_, i) => `Needle ${i} other.`).join("\n\n")}`,
			"needle.md",
			false,
		);
		const found = searchMatch(entries, "needle");
		expect(found.total).toBe(53);
		expect(found.results).toHaveLength(40);
		expect(found.results.slice(0, 3).map((entry) => entry.kind)).toEqual(["document", "heading", "heading"]);
		expect(searchMatch(entries, "other 49").results[0]?.snippet).toBe("Needle 49 other.");
		expect(searchMatch(entries, "missing").results).toEqual([]);
		expect(searchMatch(entries, "  ").total).toBe(0);
	});
});
