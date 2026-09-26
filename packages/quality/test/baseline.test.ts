import { describe, expect, it } from "vitest";
import { applyBaseline } from "../src/baseline/compare.ts";
import { decodeBaseline, encodeBaseline, indentOf } from "../src/baseline/format.ts";
import { levels, violation } from "./support/violations.ts";

const known = levels({ "local/off": "off", "local/todo": "warn", "structure/max-lines": "error" });
const todo = violation({ file: "src/a.ts", level: "warn", rule: "local/todo" });
const long = (lines: number) => violation({ file: "src/big.ts", measure: lines, rule: "structure/max-lines" });

describe("baseline check", () => {
	it("covers a file that holds its baselined count", () => {
		const checked = applyBaseline([todo, todo], [{ count: 2, file: "src/a.ts", rule: "local/todo" }], known);
		expect(checked).toEqual({ baselined: 2, kept: [], regressions: [], stale: [] });
	});

	it("fails a file that gained a violation and keeps all of them", () => {
		const checked = applyBaseline([todo, todo, todo], [{ count: 2, file: "src/a.ts", rule: "local/todo" }], known);
		expect(checked.kept).toHaveLength(3);
		expect(checked.regressions).toEqual([{ entry: { count: 2, file: "src/a.ts", rule: "local/todo" }, tally: { count: 3, measure: undefined } }]);
	});

	it("fails a file that grew past its baselined measure", () => {
		const checked = applyBaseline([long(420)], [{ count: 1, file: "src/big.ts", measure: 400, rule: "structure/max-lines" }], known);
		expect(checked.kept).toEqual([long(420)]);
		expect(checked.regressions[0]?.tally).toEqual({ count: 1, measure: 420 });
	});

	it("keeps violations in files the baseline does not name", () => {
		const other = violation({ file: "src/b.ts", rule: "local/todo" });
		expect(applyBaseline([other], [], known).kept).toEqual([other]);
	});

	it("reports fixed debt as stale", () => {
		const checked = applyBaseline([], [{ count: 1, file: "src/gone.ts", rule: "local/todo" }], known);
		expect(checked.stale.map((stale) => stale.problem)).toEqual(["has no violations left"]);
	});

	it("reports an entry that allows more than is left, by count or by measure", () => {
		const checked = applyBaseline(
			[todo, long(380)],
			[
				{ count: 3, file: "src/a.ts", rule: "local/todo" },
				{ count: 1, file: "src/big.ts", measure: 400, rule: "structure/max-lines" },
			],
			known,
		);
		expect(checked.baselined).toBe(2);
		expect(checked.stale.map((stale) => stale.problem)).toEqual([
			"allows more than is left: 1 violation against 3 violations baselined",
			"allows more than is left: 1 violation measuring 380 against 1 violation measuring 400 baselined",
		]);
	});

	it("reports entries for unknown and disabled rules", () => {
		const checked = applyBaseline(
			[],
			[
				{ count: 1, file: "src/a.ts", rule: "local/typo" },
				{ count: 1, file: "src/a.ts", rule: "local/off" },
			],
			known,
		);
		expect(checked.stale.map((stale) => stale.problem)).toEqual(["names no known rule", "names a rule that is off"]);
	});
});

describe("baseline file", () => {
	const entries = [
		{ count: 1, file: "src/b.ts", measure: 412, rule: "structure/max-lines" },
		{ count: 3, file: "src/z.ts", rule: "local/todo" },
		{ count: 1, file: "src/a.ts", measure: 380, rule: "structure/max-lines" },
	];

	it("writes rules and files in a stable order", () => {
		const text = encodeBaseline(entries, "\t");
		expect(Object.keys(JSON.parse(text))).toEqual(["local/todo", "structure/max-lines"]);
		expect(Object.keys(JSON.parse(text)["structure/max-lines"])).toEqual(["src/a.ts", "src/b.ts"]);
		expect(text.endsWith("}\n")).toBe(true);
	});

	it("reads back what it writes", async () => {
		const decoded = await decodeBaseline(encodeBaseline(entries, "  "));
		expect(decoded._tag === "Valid" ? [...decoded.value].sort((a, b) => a.file.localeCompare(b.file)) : decoded).toEqual([
			entries[2],
			entries[0],
			entries[1],
		]);
	});

	it("keeps the indentation of the existing file", () => {
		expect(indentOf(encodeBaseline(entries, "  "))).toBe("  ");
		expect(indentOf(undefined)).toBe("\t");
	});

	it("treats a missing file as an empty baseline", async () => {
		expect(await decodeBaseline(undefined)).toEqual({ _tag: "Valid", value: [] });
	});

	it.each([
		["a zero count", { "local/todo": { "src/a.ts": { count: 0 } } }],
		["a fractional count", { "local/todo": { "src/a.ts": { count: 1.5 } } }],
		["an unknown field", { "local/todo": { "src/a.ts": { count: 1, lines: 3 } } }],
		["a list", [{ count: 1, file: "src/a.ts", rule: "local/todo" }]],
	])("rejects %s", async (_, content) => {
		expect((await decodeBaseline(JSON.stringify(content)))._tag).toBe("Invalid");
	});
});
