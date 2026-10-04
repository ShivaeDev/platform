import { describe, expect, it } from "vitest";
import { applyBaseline } from "#baseline/compare.ts";
import { decodeBaseline, encodeBaseline } from "#baseline/format.ts";
import { levels, violation } from "#test/support/violations.ts";

const known = levels({ "local/off": "off", "local/todo": "warn", "structure/max-lines": "error" });
const todo = violation({ file: "src/a.ts", level: "warn", rule: "local/todo" });
const long = (lines: number) => violation({ count: lines - 150, file: "src/big.ts", rule: "structure/max-lines", threshold: 150 });

describe("baseline coverage", () => {
	it("covers a file that holds its baselined count", () => {
		const checked = applyBaseline([todo, todo], [{ count: 2, file: "src/a.ts", rule: "local/todo" }], known);
		expect(checked).toEqual({ baselined: 2, kept: [], loose: [], regressions: [], stale: [] });
	});

	it("fails a file that gained a violation and keeps all of them", () => {
		const checked = applyBaseline([todo, todo, todo], [{ count: 2, file: "src/a.ts", rule: "local/todo" }], known);
		expect(checked.kept).toHaveLength(3);
		expect(checked.regressions).toEqual([{ count: 3, entry: { count: 2, file: "src/a.ts", rule: "local/todo" } }]);
	});

	it("fails a file that grew further above its limit than its baselined count", () => {
		const checked = applyBaseline([long(420)], [{ count: 250, file: "src/big.ts", rule: "structure/max-lines" }], known);
		expect(checked.kept).toEqual([long(420)]);
		expect(checked.regressions[0]?.count).toBe(270);
	});

	it("covers a file at its baselined count, whatever a finding counts for", () => {
		expect(applyBaseline([long(400)], [{ count: 250, file: "src/big.ts", rule: "structure/max-lines" }], known).loose).toEqual([]);
	});

	it("keeps violations in files the baseline does not name", () => {
		const other = violation({ file: "src/b.ts", rule: "local/todo" });
		expect(applyBaseline([other], [], known).kept).toEqual([other]);
	});

	it("reports fixed debt as loose, not stale", () => {
		const checked = applyBaseline([], [{ count: 1, file: "src/gone.ts", rule: "local/todo" }], known);
		expect(checked.loose.map((loose) => loose.problem)).toEqual(["has no violations left"]);
		expect(checked.stale).toEqual([]);
	});

	it("covers a file that shrank and reports its entry as loose", () => {
		const checked = applyBaseline(
			[todo, long(380)],
			[
				{ count: 3, file: "src/a.ts", rule: "local/todo" },
				{ count: 250, file: "src/big.ts", rule: "structure/max-lines" },
			],
			known,
		);
		expect(checked.baselined).toBe(2);
		expect(checked.kept).toEqual([]);
		expect(checked.loose.map((loose) => loose.problem)).toEqual([
			"allows more than is left: 1 against 3 baselined",
			"allows more than is left: 230 against 250 baselined",
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

	it("knows the rules a family reports under its own name", () => {
		const family = levels({ tool: "error" }, { families: ["tool"] });
		const finding = violation({ file: "src/a.ts", rule: "tool/lint/eqeq" });
		const checked = applyBaseline(
			[finding],
			[
				{ count: 1, file: "src/a.ts", rule: "tool/lint/eqeq" },
				{ count: 1, file: "src/a.ts", rule: "tool/format" },
				{ count: 1, file: "src/a.ts", rule: "toolkit/x" },
			],
			family,
		);
		expect(checked.baselined).toBe(1);
		expect(checked.loose.map((loose) => loose.problem)).toEqual(["has no violations left"]);
		expect(checked.stale.map((stale) => stale.problem)).toEqual(["names no known rule"]);
	});
});

describe("baseline file", () => {
	const entries = [
		{ count: 262, file: "src/b.ts", rule: "structure/max-lines" },
		{ count: 3, file: "src/a.ts", rule: "local/todo" },
		{ count: 230, file: "src/a.ts", rule: "structure/max-lines" },
	];

	it("writes one entry per line, sorted by path and then rule", () => {
		expect(encodeBaseline(entries)).toBe(
			[
				'{"path":"src/a.ts","rule":"local/todo","count":3}',
				'{"path":"src/a.ts","rule":"structure/max-lines","count":230}',
				'{"path":"src/b.ts","rule":"structure/max-lines","count":262}',
				"",
			].join("\n"),
		);
	});

	it("reads back what it writes, in file order", async () => {
		expect(await decodeBaseline(encodeBaseline(entries))).toEqual({ _tag: "Valid", value: [entries[1], entries[2], entries[0]] });
	});

	it("treats a missing file and blank lines as no entries", async () => {
		expect(await decodeBaseline(undefined)).toEqual({ _tag: "Valid", value: [] });
		expect(await decodeBaseline("\n\n")).toEqual({ _tag: "Valid", value: [] });
	});

	it.each([
		["a zero count", '{"path":"src/a.ts","rule":"local/todo","count":0}', "line 2: count"],
		["a fractional count", '{"path":"src/a.ts","rule":"local/todo","count":1.5}', "line 2: count"],
		["an unknown field", '{"path":"src/a.ts","rule":"local/todo","count":1,"line":3}', "line 2: line"],
		["a measure next to the count", '{"path":"src/a.ts","rule":"structure/max-lines","count":1,"measure":168}', "line 2: measure"],
		["a missing path", '{"rule":"local/todo","count":1}', "line 2: path"],
		["a line that is not JSON", "src/a.ts local/todo 1", "line 2:"],
		["a repeated entry", '{"path":"src/z.ts","rule":"local/todo","count":2}', "line 2: repeats the entry for local/todo in src/z.ts"],
		["the earlier JSON format", '{ "local/todo": { "src/a.ts": { "count": 1 } } }', "line 2: path"],
	])("rejects %s, naming its line", async (_, line, issue) => {
		const decoded = await decodeBaseline(`{"path":"src/z.ts","rule":"local/todo","count":1}\n${line}\n`);
		expect(decoded).toEqual({ _tag: "Invalid", issues: expect.arrayContaining([expect.stringContaining(issue)]) });
	});
});
