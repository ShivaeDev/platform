import { describe, expect, it } from "vitest";
import { evaluate, passes } from "../src/engine/evaluate.ts";
import { type ReportContext, render } from "../src/report/render.ts";
import { levels, violation } from "./support/violations.ts";

const known = levels({ "local/todo": "warn", "structure/max-lines": "error" });

const context = (overrides: Partial<ReportContext> = {}): ReportContext => ({
	baseline: "quality/baseline.jsonl",
	checked: 12,
	descriptions: new Map([["structure/max-lines", "Keep each module to one job."]]),
	registry: "quality/registry.json",
	warnings: "summary",
	...overrides,
});

const long = (file: string, lines: number) =>
	violation({ count: lines - 150, file, message: `${lines} lines exceeds the 150-line limit.`, rule: "structure/max-lines", threshold: 150 });
const todo = (file: string, line: number) => violation({ file, level: "warn", line, message: "Resolve this TODO.", rule: "local/todo" });
const todos = ["a", "b", "c", "d", "e", "f", "g"].flatMap((name, index) =>
	Array.from({ length: 7 - index }, (_, line) => todo(`src/${name}.ts`, line + 1)),
);

describe("evaluation", () => {
	it("passes a baseline entry that allows more than is left", () => {
		expect(passes(evaluate([], [], [{ count: 1, file: "src/gone.ts", rule: "local/todo" }], known))).toBe(true);
	});

	it("fails on a stale registry entry or a baseline entry for an unknown rule alone", () => {
		expect(passes(evaluate([], [{ file: "src/gone.ts", reason: "Kept for a reason.", rule: "local/todo" }], [], known))).toBe(false);
		expect(passes(evaluate([], [], [{ count: 1, file: "src/a.ts", rule: "local/typo" }], known))).toBe(false);
	});

	it("applies the registry before the baseline", () => {
		const registry = [{ file: "src/big.ts", reason: "Generated upstream.", rule: "structure/max-lines" }];
		const outcome = evaluate([long("src/big.ts", 151)], registry, [{ count: 1, file: "src/big.ts", rule: "structure/max-lines" }], known);
		expect(outcome.registered).toBe(1);
		expect(outcome.looseBaseline.map((loose) => loose.problem)).toEqual(["has no violations left"]);
	});
});

describe("report", () => {
	it("groups errors by rule, states the rule's guidance once and locates each violation", () => {
		const text = render(
			evaluate([long("src/b.ts", 200), violation({ file: "src/a.ts", line: 3, rule: "local/x" }), long("src/a.ts", 160)], [], [], known),
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
		const text = render(evaluate([long("src/big.ts", 420)], [], [{ count: 250, file: "src/big.ts", rule: "structure/max-lines" }], known), context());
		expect(text).toContain("  src/big.ts is over its baseline: 270 against 250 baselined.");
	});

	it("summarizes warnings by file, busiest first", () => {
		const text = render(evaluate(todos, [], [], known), context());
		expect(text).toContain(
			"warn local/todo (28)\n  src/a.ts (7), src/b.ts (6), src/c.ts (5), src/d.ts (4), src/e.ts (3), and 2 more files. --warnings all lists each one.",
		);
		expect(text).toContain("quality: passed; 28 warnings from rules still at warn. 12 source files checked.");
	});

	it("lists every warning on request", () => {
		const text = render(evaluate(todos, [], [], known), context({ warnings: "all" }));
		expect(text).toContain("  src/g.ts:1  Resolve this TODO.");
		expect(text.split("\n").filter((line) => line.endsWith("Resolve this TODO."))).toHaveLength(28);
	});

	it("lists stale entries with what to do about them, and notes loose ones without failing", () => {
		const outcome = evaluate(
			[],
			[{ file: "src/a.ts", reason: "Kept.", rule: "local/todo", subject: "legacy" }],
			[
				{ count: 2, file: "src/gone.ts", rule: "structure/max-lines" },
				{ count: 1, file: "src/a.ts", rule: "local/typo" },
			],
			known,
		);
		expect(render(outcome, context())).toBe(
			[
				"error quality/baseline.jsonl: 1 stale entry\n  An entry for a rule that is off or unknown covers nothing. Run `quality baseline prune` to drop it.\n  local/typo src/a.ts names no known rule.",
				"note quality/baseline.jsonl: 1 stale entry\n  These pass, and `quality baseline tighten` lowers them when their files change. `quality baseline prune` lowers them all.\n  structure/max-lines src/gone.ts has no violations left.",
				"error quality/registry.json: 1 stale entry\n  Every registered exception must still apply. Remove the entries whose exception is gone.\n  local/todo src/a.ts (legacy) matches no violation.",
				"quality: failed with 2 stale entries. 12 source files checked.",
			].join("\n\n"),
		);
	});

	it("counts what the baseline and registry hide", () => {
		const outcome = evaluate(
			[long("src/a.ts", 151), long("src/b.ts", 151)],
			[{ file: "src/a.ts", reason: "Generated.", rule: "structure/max-lines" }],
			[{ count: 1, file: "src/b.ts", rule: "structure/max-lines" }],
			known,
		);
		expect(render(outcome, context({ checked: 1 }))).toBe(
			"quality: passed. 1 source file checked; 1 baselined and 1 registered violations not shown.",
		);
	});
});
