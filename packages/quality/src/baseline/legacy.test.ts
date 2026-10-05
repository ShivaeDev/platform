import { describe, expect, it } from "vitest";
import { convertLegacy } from "#baseline/legacy.ts";
import { violation } from "#test/violations.ts";

describe("legacy baseline conversion", () => {
	it("turns a measure into the violations above the rule's current threshold", () => {
		const long = violation({ count: 18, file: "src/big.ts", rule: "structure/max-lines", threshold: 150 });
		expect(convertLegacy([{ count: 1, file: "src/big.ts", measure: 200, rule: "structure/max-lines" }], [long])).toEqual([
			{ count: 50, file: "src/big.ts", rule: "structure/max-lines" },
		]);
	});

	it("drops a measured entry whose file no longer breaks the rule", () => {
		expect(convertLegacy([{ count: 1, file: "src/big.ts", measure: 200, rule: "structure/max-lines" }], [])).toEqual([]);
	});

	it("uses the current count for a measuring rule that reports no threshold", () => {
		const finding = violation({ count: 3, file: "src/a.ts", rule: "local/size" });
		expect(convertLegacy([{ count: 1, file: "src/a.ts", measure: 90, rule: "local/size" }], [finding])).toEqual([
			{ count: 3, file: "src/a.ts", rule: "local/size" },
		]);
	});

	it("keeps the count of an entry without a measure", () => {
		const entry = { count: 4, file: "src/a.ts", rule: "comments/no-todo" };
		expect(convertLegacy([entry], [])).toEqual([entry]);
	});
});
