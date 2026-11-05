import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { sameWord } from "#naming/words.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

describe("sameWord", () => {
	it.effect("matches the plural folder name categories to the singular category", function* () {
		yield* assertThat(sameWord("categories", "category"), (actual) => actual.toBe(true));
	});

	it.effect("does not match categories to a different word with the same start, catalog", function* () {
		yield* assertThat(sameWord("categories", "catalog"), (actual) => actual.toBe(false));
	});
});
