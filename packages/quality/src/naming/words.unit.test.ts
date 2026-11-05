import { describe, expect, it } from "vitest";
import { sameWord } from "#naming/words.ts";

describe("sameWord", () => {
	it("matches the plural folder name categories to the singular category", () => {
		expect(sameWord("categories", "category")).toBe(true);
	});

	it("does not match categories to a different word with the same start, catalog", () => {
		expect(sameWord("categories", "catalog")).toBe(false);
	});
});
