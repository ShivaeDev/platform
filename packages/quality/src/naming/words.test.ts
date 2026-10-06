import { describe, expect, it } from "vitest";
import { sameWord } from "#naming/words.ts";

describe("plural folder names", () => {
	it("matches a categories folder to a category export without matching a different topic", () => {
		expect(sameWord("categories", "category")).toBe(true);
		expect(sameWord("categories", "catalog")).toBe(false);
	});
});
