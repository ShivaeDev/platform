import { describe, expect, it } from "vitest";
import { guardBaseline } from "../src/baseline/guard.ts";

const big = { count: 1, file: "src/big.ts", measure: 400, rule: "structure/max-lines" };
const jsdoc = { count: 3, file: "src/a.ts", rule: "comments/no-jsdoc" };
const none = new Map<string, string>();

describe("baseline guard", () => {
	it("holds a baseline that stayed or shrank", () => {
		const shrunk = { ...big, measure: 380 };
		expect(guardBaseline([big, jsdoc], [shrunk], none, [])).toEqual({ adopted: [], moved: 0, problems: [] });
	});

	it("fails an entry the base does not have, for a rule it already covers", () => {
		const added = { count: 1, file: "src/new.ts", measure: 200, rule: "structure/max-lines" };
		expect(guardBaseline([big], [big, added], none, []).problems).toEqual([{ _tag: "Added", entry: added }]);
	});

	it.each([
		["a higher count", { ...jsdoc, count: 4 }, jsdoc],
		["a higher measure", { ...big, measure: 401 }, big],
		["a dropped measure", { count: 1, file: "src/big.ts", rule: "structure/max-lines" }, big],
	])("fails %s", (_, entry, base) => {
		expect(guardBaseline([base], [entry], none, []).problems).toEqual([{ _tag: "Raised", base, entry }]);
	});

	it("matches a moved file's entry to its old path, and still refuses growth", () => {
		const renames = new Map([["lib/big.ts", "src/big.ts"]]);
		expect(guardBaseline([big], [{ ...big, file: "lib/big.ts" }], renames, [])).toEqual({ adopted: [], moved: 1, problems: [] });
		const grown = { ...big, file: "lib/big.ts", measure: 410 };
		expect(guardBaseline([big], [grown], renames, []).problems).toEqual([{ _tag: "Raised", base: big, entry: grown }]);
	});

	it("does not let a file that was not moved take another file's entry", () => {
		const elsewhere = { ...big, file: "lib/big.ts" };
		expect(guardBaseline([big], [elsewhere], none, []).problems).toEqual([{ _tag: "Added", entry: elsewhere }]);
	});

	it("fails a rule baselined for the first time unless adopt names it", () => {
		expect(guardBaseline([big], [big, jsdoc], none, []).problems).toEqual([{ _tag: "Unadopted", entries: 1, rule: "comments/no-jsdoc" }]);
		expect(guardBaseline([big], [big, jsdoc], none, ["comments/no-jsdoc"])).toEqual({ adopted: ["comments/no-jsdoc"], moved: 0, problems: [] });
	});

	it("treats a missing base baseline as one that covers no rule", () => {
		expect(guardBaseline([], [big], none, []).problems).toEqual([{ _tag: "Unadopted", entries: 1, rule: "structure/max-lines" }]);
		expect(guardBaseline([], [big], none, ["structure/max-lines"]).problems).toEqual([]);
	});

	it("gives an adopted rule no room to grow once the base covers it", () => {
		const added = { ...jsdoc, file: "src/b.ts" };
		expect(guardBaseline([jsdoc], [jsdoc, added], none, ["comments/no-jsdoc"]).problems).toEqual([{ _tag: "Added", entry: added }]);
	});

	it("fails an adopt entry that names a rule with nothing baselined", () => {
		expect(guardBaseline([big], [big], none, ["comments/no-todo"]).problems).toEqual([{ _tag: "NothingAdopted", rule: "comments/no-todo" }]);
	});
});
