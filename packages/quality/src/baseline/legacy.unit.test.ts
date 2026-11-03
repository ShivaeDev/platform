import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { convertLegacy } from "#baseline/legacy.ts";
import { violation } from "#test/violations.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

describe("convertLegacy", () => {
	it.effect("turns a measure into the violations above the rule's current threshold", function* () {
		const long = violation({ count: 18, file: "src/big.ts", rule: "structure/max-lines", threshold: 150 });
		yield* assertThat(convertLegacy([{ count: 1, file: "src/big.ts", measure: 200, rule: "structure/max-lines" }], [long]), (actual) =>
			actual.toEqual([{ count: 50, file: "src/big.ts", rule: "structure/max-lines" }]),
		);
	});

	it.effect("drops a measured entry whose file no longer breaks the rule", function* () {
		yield* assertThat(convertLegacy([{ count: 1, file: "src/big.ts", measure: 200, rule: "structure/max-lines" }], []), (actual) =>
			actual.toEqual([]),
		);
	});

	it.effect("uses the current count for a measuring rule that reports no threshold", function* () {
		const finding = violation({ count: 3, file: "src/a.ts", rule: "local/size" });
		yield* assertThat(convertLegacy([{ count: 1, file: "src/a.ts", measure: 90, rule: "local/size" }], [finding]), (actual) =>
			actual.toEqual([{ count: 3, file: "src/a.ts", rule: "local/size" }]),
		);
	});

	it.effect("keeps the count of an entry without a measure", function* () {
		const entry = { count: 4, file: "src/a.ts", rule: "comments/no-todo" };
		yield* assertThat(convertLegacy([entry], []), (actual) => actual.toEqual([entry]));
	});
});
