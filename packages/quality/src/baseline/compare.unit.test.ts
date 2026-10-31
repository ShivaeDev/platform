import { describe, expect, it } from "vitest";
import { applyBaseline } from "#baseline/compare.ts";
import { levels, violation } from "#test/violations.ts";

const known = levels({ "local/todo": "error", "structure/max-lines": "error" });
const todo = violation({ file: "src/a.ts", rule: "local/todo" });
function long(lines: number) {
	return violation({ count: lines - 150, file: "src/big.ts", rule: "structure/max-lines", threshold: 150 });
}

describe("applyBaseline", () => {
	it("covers a file that holds its baselined count", () => {
		expect(applyBaseline([todo, todo], [{ count: 2, file: "src/a.ts", rule: "local/todo" }], known)).toEqual({
			baselined: 2,
			kept: [],
			loose: [],
			regressions: [],
			stale: [],
		});
	});

	it("covers a file whose single finding counts exactly its baselined count", () => {
		expect(applyBaseline([long(400)], [{ count: 250, file: "src/big.ts", rule: "structure/max-lines" }], known)).toEqual({
			baselined: 1,
			kept: [],
			loose: [],
			regressions: [],
			stale: [],
		});
	});

	it("keeps every violation of a file that gained one and reports the regression", () => {
		const entry = { count: 2, file: "src/a.ts", rule: "local/todo" };
		const checked = applyBaseline([todo, todo, todo], [entry], known);
		expect({ kept: checked.kept, regressions: checked.regressions }).toEqual({ kept: [todo, todo, todo], regressions: [{ count: 3, entry }] });
	});

	it("keeps the finding of a file that grew further over its limit than its baselined count and reports the regression", () => {
		const entry = { count: 250, file: "src/big.ts", rule: "structure/max-lines" };
		const checked = applyBaseline([long(420)], [entry], known);
		expect({ kept: checked.kept, regressions: checked.regressions }).toEqual({ kept: [long(420)], regressions: [{ count: 270, entry }] });
	});

	it("keeps violations in files the baseline does not name", () => {
		const other = violation({ file: "src/b.ts", rule: "local/todo" });
		expect(applyBaseline([other], [], known).kept).toEqual([other]);
	});

	it("reports fixed debt as loose, not stale", () => {
		const checked = applyBaseline([], [{ count: 1, file: "src/gone.ts", rule: "local/todo" }], known);
		expect({ loose: checked.loose.map((loose) => loose.problem), stale: checked.stale }).toEqual({ loose: ["has no violations left"], stale: [] });
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
		expect({ baselined: checked.baselined, kept: checked.kept, loose: checked.loose.map((loose) => loose.problem) }).toEqual({
			baselined: 2,
			kept: [],
			loose: ["allows more than is left: 1 against 3 baselined", "allows more than is left: 230 against 250 baselined"],
		});
	});

	it("reports an entry for an unknown rule as stale", () => {
		const checked = applyBaseline([], [{ count: 1, file: "src/a.ts", rule: "local/typo" }], known);
		expect(checked.stale.map((stale) => stale.problem)).toEqual(["names no known rule"]);
	});

	it("knows the rules a family reports under its own name and no rule that merely shares its prefix", () => {
		const family = levels({ tool: "error" }, { families: ["tool"] });
		const checked = applyBaseline(
			[violation({ file: "src/a.ts", rule: "tool/lint/eqeq" })],
			[
				{ count: 1, file: "src/a.ts", rule: "tool/lint/eqeq" },
				{ count: 1, file: "src/a.ts", rule: "tool/format" },
				{ count: 1, file: "src/a.ts", rule: "toolkit/x" },
			],
			family,
		);
		expect({
			baselined: checked.baselined,
			loose: checked.loose.map((loose) => loose.entry.rule),
			stale: checked.stale.map((stale) => stale.entry.rule),
		}).toEqual({ baselined: 1, loose: ["tool/format"], stale: ["toolkit/x"] });
	});
});
