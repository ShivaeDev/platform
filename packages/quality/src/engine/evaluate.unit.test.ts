import { describe, expect, it } from "vitest";
import { evaluate, passes } from "#engine/evaluate.ts";
import { levels, violation } from "#test/violations.ts";

const known = levels({ "local/todo": "error", "structure/max-lines": "error" });

function long(file: string, lines: number) {
	return violation({ count: lines - 150, file, message: `${lines} lines exceeds the 150-line limit.`, rule: "structure/max-lines", threshold: 150 });
}

describe("evaluate", () => {
	it("passes a baseline entry that allows more than is left", () => {
		expect(passes(evaluate([], [], [{ count: 1, file: "src/gone.ts", rule: "local/todo" }], known))).toBe(true);
	});

	it("fails on a stale registry entry alone", () => {
		expect(passes(evaluate([], [{ file: "src/gone.ts", reason: "Kept for a reason.", rule: "local/todo" }], [], known))).toBe(false);
	});

	it("fails on a baseline entry for an unknown rule alone", () => {
		expect(passes(evaluate([], [], [{ count: 1, file: "src/a.ts", rule: "local/typo" }], known))).toBe(false);
	});

	it("applies the registry before the baseline, which then holds a loose entry", () => {
		const registry = [{ file: "src/big.ts", reason: "Generated upstream.", rule: "structure/max-lines" }];
		const outcome = evaluate([long("src/big.ts", 151)], registry, [{ count: 1, file: "src/big.ts", rule: "structure/max-lines" }], known);
		expect({ loose: outcome.looseBaseline.map((loose) => loose.problem), registered: outcome.registered }).toEqual({
			loose: ["has no violations left"],
			registered: 1,
		});
	});

	it("sets aside the baseline entries and exceptions of a rule the run skipped", () => {
		const skipped = levels({ "local/deep": "error" }, { skipped: ["local/deep"] });
		const outcome = evaluate(
			[],
			[{ file: "src/a.ts", reason: "Kept for a reason.", rule: "local/deep" }],
			[{ count: 2, file: "src/b.ts", rule: "local/deep" }],
			skipped,
		);
		expect({ loose: outcome.looseBaseline, stale: [...outcome.staleBaseline, ...outcome.staleRegistry] }).toEqual({ loose: [], stale: [] });
	});

	it("still refuses an exception for a skipped rule that takes no exceptions", () => {
		const skipped = levels({ "local/deep": "error" }, { skipped: ["local/deep"], unregistrable: ["local/deep"] });
		const outcome = evaluate([], [{ file: "src/a.ts", reason: "Kept for a reason.", rule: "local/deep" }], [], skipped);
		expect(outcome.staleRegistry.map(({ problem }) => problem)).toEqual([expect.stringContaining("takes no exceptions")]);
	});

	it("judges a halved rule's baseline entries only by the findings its fast half can report", () => {
		const halved = levels({ "local/split": "error" }, { skippedHalves: ["local/split"], split: ["local/split"] });
		function found(file: string, count: number) {
			return Array.from({ length: count }, () => violation({ file, rule: "local/split" }));
		}
		const outcome = evaluate(
			[...found("src/fewer.ts", 1), ...found("src/more.ts", 3)],
			[{ file: "src/deep.ts", reason: "Kept for a reason.", rule: "local/split" }],
			[
				{ count: 2, file: "src/deep.ts", rule: "local/split" },
				{ count: 2, file: "src/fewer.ts", rule: "local/split" },
				{ count: 2, file: "src/more.ts", rule: "local/split" },
			],
			halved,
		);
		expect({
			loose: outcome.looseBaseline,
			regressions: outcome.regressions.map(({ entry }) => entry.file),
			stale: [...outcome.staleBaseline, ...outcome.staleRegistry],
		}).toEqual({ loose: [], regressions: ["src/more.ts"], stale: [] });
	});
});
