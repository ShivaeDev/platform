import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { evaluate } from "#engine/evaluate.ts";
import { type ReportContext, render } from "#report/render.ts";
import { levels, violation } from "#test/violations.ts";

const known = levels({ "local/todo": "error", "structure/max-lines": "error" });

function context(overrides: Partial<ReportContext> = {}): ReportContext {
	return {
		baseline: "quality-baseline.jsonl",
		checked: 12,
		descriptions: new Map([["structure/max-lines", "Keep each module to one job."]]),
		registry: "quality/registry.json",
		...overrides,
	};
}

function long(file: string, lines: number) {
	return violation({ count: lines - 150, file, message: `${lines} lines exceeds the 150-line limit.`, rule: "structure/max-lines", threshold: 150 });
}

describe("render", () => {
	it.effect("groups errors by rule, states the rule's guidance once and locates each violation", function* () {
		const text = render(
			evaluate([long("src/b.ts", 200), violation({ file: "src/a.ts", line: 3, rule: "local/x" }), long("src/a.ts", 160)], [], [], known),
			context(),
		);
		yield* assertThat(text, (actual) =>
			actual.toBe(
				[
					"error local/x (1)\n  src/a.ts:3  local/x in src/a.ts",
					[
						"error structure/max-lines (2)",
						"  Keep each module to one job.",
						"  src/a.ts  160 lines exceeds the 150-line limit.",
						"  src/b.ts  200 lines exceeds the 150-line limit.",
					].join("\n"),
					"quality: failed with 3 errors. 12 source files checked.",
					"For moved files, carry their existing debt with `quality baseline prune --against <base>`.",
				].join("\n\n"),
			),
		);
	});

	it.effect("ends a pass without the hint to record findings again", function* () {
		yield* assertThat(render(evaluate([], [], [], known), context()), (actual) => actual.not.toContain("quality baseline write"));
	});

	it.effect("notes when a baselined file got worse", function* () {
		const text = render(evaluate([long("src/big.ts", 420)], [], [{ count: 250, file: "src/big.ts", rule: "structure/max-lines" }], known), context());
		yield* assertThat(text, (actual) => actual.toContain("  src/big.ts is over its baseline: 270 against 250 baselined."));
	});

	it.effect("lists stale entries with what to do about them, and notes loose ones without failing", function* () {
		const outcome = evaluate(
			[],
			[{ file: "src/a.ts", reason: "Kept.", rule: "local/todo", subject: "legacy" }],
			[
				{ count: 2, file: "src/gone.ts", rule: "structure/max-lines" },
				{ count: 1, file: "src/a.ts", rule: "local/typo" },
			],
			known,
		);
		yield* assertThat(render(outcome, context()), (actual) =>
			actual.toBe(
				[
					"error quality-baseline.jsonl: 1 stale entry\n  Drop unknown rules with `quality baseline prune`. Lower staged counts with `quality baseline tighten --staged`, then stage the baseline.\n  local/typo src/a.ts names no known rule.",
					"note quality-baseline.jsonl: 1 stale entry\n  These pass, and `quality baseline tighten` lowers them when their files change. `quality baseline prune` lowers them all.\n  structure/max-lines src/gone.ts has no violations left.",
					"error quality/registry.json: 1 stale entry\n  Every registered exception must still apply. Remove the entries whose exception is gone.\n  local/todo src/a.ts (legacy) matches no violation.",
					"quality: failed with 2 stale entries. 12 source files checked.",
					"For moved files, carry their existing debt with `quality baseline prune --against <base>`.",
				].join("\n\n"),
			),
		);
	});

	it.effect("counts what the baseline and registry hide", function* () {
		const outcome = evaluate(
			[long("src/a.ts", 151), long("src/b.ts", 151)],
			[{ file: "src/a.ts", reason: "Generated.", rule: "structure/max-lines" }],
			[{ count: 1, file: "src/b.ts", rule: "structure/max-lines" }],
			known,
		);
		yield* assertThat(render(outcome, context({ checked: 1 })), (actual) =>
			actual.toBe("quality: passed. 1 source file checked; 1 baselined and 1 registered violations not shown."),
		);
	});
});
