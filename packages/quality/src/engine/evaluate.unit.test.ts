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
});
