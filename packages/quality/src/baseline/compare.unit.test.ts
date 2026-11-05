import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { applyBaseline } from "#baseline/compare.ts";
import { levels, violation } from "#test/violations.ts";

const known = levels({ "local/todo": "error", "structure/max-lines": "error" });
const todo = violation({ file: "src/a.ts", rule: "local/todo" });
function long(lines: number) {
	return violation({ count: lines - 150, file: "src/big.ts", rule: "structure/max-lines", threshold: 150 });
}

describe("applyBaseline", () => {
	it.effect("covers a file that holds its baselined count", function* () {
		yield* assertThat(applyBaseline([todo, todo], [{ count: 2, file: "src/a.ts", rule: "local/todo" }], known), (actual) =>
			actual.toEqual({
				baselined: 2,
				kept: [],
				loose: [],
				regressions: [],
				stale: [],
			}),
		);
	});

	it.effect("covers a file whose single finding counts exactly its baselined count", function* () {
		yield* assertThat(applyBaseline([long(400)], [{ count: 250, file: "src/big.ts", rule: "structure/max-lines" }], known), (actual) =>
			actual.toEqual({
				baselined: 1,
				kept: [],
				loose: [],
				regressions: [],
				stale: [],
			}),
		);
	});

	it.effect("keeps every violation of a file that gained one and reports the regression", function* () {
		const entry = { count: 2, file: "src/a.ts", rule: "local/todo" };
		const checked = applyBaseline([todo, todo, todo], [entry], known);
		yield* assertThat({ kept: checked.kept, regressions: checked.regressions }, (actual) =>
			actual.toEqual({ kept: [todo, todo, todo], regressions: [{ count: 3, entry }] }),
		);
	});

	it.effect("keeps the finding of a file that grew further over its limit than its baselined count and reports the regression", function* () {
		const entry = { count: 250, file: "src/big.ts", rule: "structure/max-lines" };
		const checked = applyBaseline([long(420)], [entry], known);
		yield* assertThat({ kept: checked.kept, regressions: checked.regressions }, (actual) =>
			actual.toEqual({ kept: [long(420)], regressions: [{ count: 270, entry }] }),
		);
	});

	it.effect("keeps violations in files the baseline does not name", function* () {
		const other = violation({ file: "src/b.ts", rule: "local/todo" });
		yield* assertThat(applyBaseline([other], [], known).kept, (actual) => actual.toEqual([other]));
	});

	it.effect("reports fixed debt as loose, not stale", function* () {
		const checked = applyBaseline([], [{ count: 1, file: "src/gone.ts", rule: "local/todo" }], known);
		yield* assertThat({ loose: checked.loose.map((loose) => loose.problem), stale: checked.stale }, (actual) =>
			actual.toEqual({ loose: ["has no violations left"], stale: [] }),
		);
	});

	it.effect("covers a file that shrank and reports its entry as loose", function* () {
		const checked = applyBaseline(
			[todo, long(380)],
			[
				{ count: 3, file: "src/a.ts", rule: "local/todo" },
				{ count: 250, file: "src/big.ts", rule: "structure/max-lines" },
			],
			known,
		);
		yield* assertThat({ baselined: checked.baselined, kept: checked.kept, loose: checked.loose.map((loose) => loose.problem) }, (actual) =>
			actual.toEqual({
				baselined: 2,
				kept: [],
				loose: ["allows more than is left: 1 against 3 baselined", "allows more than is left: 230 against 250 baselined"],
			}),
		);
	});

	it.effect("reports an entry for an unknown rule as stale", function* () {
		const checked = applyBaseline([], [{ count: 1, file: "src/a.ts", rule: "local/typo" }], known);
		yield* assertThat(
			checked.stale.map((stale) => stale.problem),
			(actual) => actual.toEqual(["names no known rule"]),
		);
	});

	it.effect("knows the rules a family reports under its own name and no rule that merely shares its prefix", function* () {
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
		yield* assertThat(
			{
				baselined: checked.baselined,
				loose: checked.loose.map((loose) => loose.entry.rule),
				stale: checked.stale.map((stale) => stale.entry.rule),
			},
			(actual) => actual.toEqual({ baselined: 1, loose: ["tool/format"], stale: ["toolkit/x"] }),
		);
	});
});
