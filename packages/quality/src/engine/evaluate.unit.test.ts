import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { evaluate, passes } from "#engine/evaluate.ts";
import { levels, violation } from "#test/violations.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const known = levels({ "local/todo": "error", "structure/max-lines": "error" });

function long(file: string, lines: number) {
	return violation({ count: lines - 150, file, message: `${lines} lines exceeds the 150-line limit.`, rule: "structure/max-lines", threshold: 150 });
}

describe("evaluate", () => {
	it.effect("passes a baseline entry that allows more than is left", function* () {
		yield* assertThat(passes(evaluate([], [], [{ count: 1, file: "src/gone.ts", rule: "local/todo" }], known)), (actual) => actual.toBe(true));
	});

	it.effect("fails on a stale registry entry alone", function* () {
		yield* assertThat(passes(evaluate([], [{ file: "src/gone.ts", reason: "Kept for a reason.", rule: "local/todo" }], [], known)), (actual) =>
			actual.toBe(false),
		);
	});

	it.effect("fails on a baseline entry for an unknown rule alone", function* () {
		yield* assertThat(passes(evaluate([], [], [{ count: 1, file: "src/a.ts", rule: "local/typo" }], known)), (actual) => actual.toBe(false));
	});

	it.effect("applies the registry before the baseline, which then holds a loose entry", function* () {
		const registry = [{ file: "src/big.ts", reason: "Generated upstream.", rule: "structure/max-lines" }];
		const outcome = evaluate([long("src/big.ts", 151)], registry, [{ count: 1, file: "src/big.ts", rule: "structure/max-lines" }], known);
		yield* assertThat({ loose: outcome.looseBaseline.map((loose) => loose.problem), registered: outcome.registered }, (actual) =>
			actual.toEqual({
				loose: ["has no violations left"],
				registered: 1,
			}),
		);
	});
});
