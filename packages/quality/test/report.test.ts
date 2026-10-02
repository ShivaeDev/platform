import { describe, expect, it } from "vitest";
import { evaluate, passes } from "../src/engine/evaluate.ts";
import { type ReportContext, render } from "../src/report/render.ts";
import { levels, violation } from "./support/violations.ts";

const known = levels({ "local/todo": "warn", "structure/max-lines": "error" });

const context = (overrides: Partial<ReportContext> = {}): ReportContext => ({
	baseline: "quality/baseline.json",
	checked: 12,
	descriptions: new Map([["structure/max-lines", "Keep each module to one job."]]),
	registry: "quality/registry.json",
	warnings: "summary",
	...overrides,
});

const long = (file: string, measure: number) =>
	violation({ file, measure, message: `${measure} lines exceeds the 150-line limit.`, rule: "structure/max-lines" });
const todo = (file: string, line: number) => violation({ file, level: "warn", line, message: "Resolve this TODO.", rule: "local/todo" });
const todos = ["a", "b", "c", "d", "e", "f", "g"].flatMap((name, index) =>
	Array.from({ length: 7 - index }, (_, line) => todo(`src/${name}.ts`, line + 1)),
);

describe("evaluation", () => {
	it("fails on a stale baseline or registry entry alone", () => {
		expect(passes(evaluate([], [], [{ count: 1, file: "src/gone.ts", rule: "local/todo" }], known, new Set()))).toBe(false);
		expect(passes(evaluate([], [{ file: "src/gone.ts", reason: "Kept for a reason.", rule: "local/todo" }], [], known, new Set()))).toBe(false);
	});

	it("applies the registry before the baseline", () => {
		const registry = [{ file: "src/big.ts", reason: "Generated upstream.", rule: "structure/max-lines" }];
		const outcome = evaluate([long("src/big.ts", 151)], registry, [{ count: 1, file: "src/big.ts", rule: "structure/max-lines" }], known, new Set());
		expect(outcome.registered).toBe(1);
		expect(outcome.staleBaseline.map((stale) => stale.problem)).toEqual(["has no violations left"]);
	});
});

describe("report", () => {
	it("groups errors by rule, states the rule's guidance once and locates each violation", () => {
		const text = render(
			evaluate([long("src/b.ts", 200), violation({ file: "src/a.ts", line: 3, rule: "local/x" }), long("src/a.ts", 160)], [], [], known, new Set()),
			context(),
		);
		expect(text).toBe(
			[
				"error local/x (1)\n  src/a.ts:3  local/x in src/a.ts",
				[
					"error structure/max-lines (2)",
					"  Keep each module to one job.",
					"  src/a.ts  160 lines exceeds the 150-line limit.",
					"  src/b.ts  200 lines exceeds the 150-line limit.",
				].join("\n"),
				"quality: failed with 3 errors. 12 source files checked.",
			].join("\n\n"),
		);
	});

	it("notes when a baselined file got worse", () => {
		const text = render(
			evaluate([long("src/big.ts", 420)], [], [{ count: 1, file: "src/big.ts", measure: 400, rule: "structure/max-lines" }], known, new Set()),
			context(),
		);
		expect(text).toContain("  src/big.ts is over its baseline: 1 violation measuring 420 against 1 violation measuring 400 baselined.");
	});

	it("summarizes warnings by file, busiest first", () => {
		const text = render(evaluate(todos, [], [], known, new Set()), context());
		expect(text).toContain(
			"warn local/todo (28)\n  src/a.ts (7), src/b.ts (6), src/c.ts (5), src/d.ts (4), src/e.ts (3), and 2 more files. --warnings all lists each one.",
		);
		expect(text).toContain("quality: passed; 28 warnings from rules still at warn. 12 source files checked.");
	});

	it("lists every warning on request", () => {
		const text = render(evaluate(todos, [], [], known, new Set()), context({ warnings: "all" }));
		expect(text).toContain("  src/g.ts:1  Resolve this TODO.");
		expect(text.split("\n").filter((line) => line.endsWith("Resolve this TODO."))).toHaveLength(28);
	});

	it("lists stale entries with what to do about them", () => {
		const outcome = evaluate(
			[],
			[{ file: "src/a.ts", reason: "Kept.", rule: "local/todo", subject: "legacy" }],
			[{ count: 2, file: "src/gone.ts", rule: "structure/max-lines" }],
			known,
			new Set(),
		);
		expect(render(outcome, context())).toBe(
			[
				"error quality/baseline.json: 1 stale entry\n  The baseline only shrinks. Run `quality baseline prune` to drop fixed debt; prune never adds or raises an entry.\n  structure/max-lines src/gone.ts has no violations left.",
				"error quality/registry.json: 1 stale entry\n  Every registered exception must still apply. Remove the entries whose exception is gone.\n  local/todo src/a.ts (legacy) matches no violation.",
				"quality: failed with 2 stale entries. 12 source files checked.",
			].join("\n\n"),
		);
	});

	it("counts what the baseline and registry hide", () => {
		const outcome = evaluate(
			[long("src/a.ts", 151), long("src/b.ts", 151)],
			[{ file: "src/a.ts", reason: "Generated.", rule: "structure/max-lines" }],
			[{ count: 1, file: "src/b.ts", measure: 151, rule: "structure/max-lines" }],
			known,
			new Set(),
		);
		expect(render(outcome, context({ checked: 1 }))).toBe(
			"quality: passed. 1 source file checked; 1 baselined and 1 registered violations not shown.",
		);
	});
});
