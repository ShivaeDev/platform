import { describe, expect, it } from "vitest";
import { evaluate } from "#engine/evaluate.ts";
import { recap } from "#report/recap.ts";
import { levels, violation } from "#test/violations.ts";

const known = levels({ "local/todo": "error", "structure/max-lines": "error" });

const context = { baseline: "quality-baseline.jsonl", checked: 12, descriptions: new Map(), registry: "quality/registry.json" };

describe("recap", () => {
	it("counts each rule's errors and names its first three files once each", () => {
		const errors = ["src/a.ts", "src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"].map((file) => violation({ file, rule: "local/todo" }));

		expect(recap(evaluate([...errors, violation({ file: "src/f.ts", rule: "structure/max-lines" })], [], [], known), context)).toBe(
			[
				"quality lint failed with 7 errors:",
				"  error local/todo (6): src/a.ts, src/b.ts, src/c.ts and 2 more files",
				"  error structure/max-lines (1): src/f.ts",
			].join("\n"),
		);
	});

	it("names the stale entries of the baseline and the registry by file", () => {
		const outcome = evaluate(
			[],
			[{ file: "src/a.ts", reason: "Kept.", rule: "local/todo" }],
			[
				{ count: 1, file: "src/b.ts", rule: "local/typo" },
				{ count: 1, file: "src/c.ts", rule: "local/typo" },
			],
			known,
		);

		expect(recap(outcome, context)).toBe(
			[
				"quality lint failed with 3 stale entries:",
				"  error quality-baseline.jsonl (2 stale entries): src/b.ts, src/c.ts",
				"  error quality/registry.json (1 stale entry): src/a.ts",
			].join("\n"),
		);
	});
});
