import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { exceptionConfig } from "./exceptionConfig.ts";

const REASON = "The external format requires it.";

describe("exceptionConfig", () => {
	it.effect("turns each declared Biome lint rule and assist action off for its files and ignores quality's own rules", function* () {
		const config = exceptionConfig([
			{
				files: ["src/parse.ts"],
				reason: REASON,
				rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny", "biome/assist/source/useSortedKeys"],
			},
		]);

		yield* assertThat(config, (actual) =>
			actual.toEqual({
				includes: [],
				overrides: [
					{ includes: ["src/parse.ts"], linter: { rules: { suspicious: { noExplicitAny: "off" } } } },
					{ assist: { actions: { source: { useSortedKeys: "off" } } }, includes: ["src/parse.ts"] },
				],
			}),
		);
	});

	it.effect("joins the directory exclusions of several declarations behind one leading **", function* () {
		const config = exceptionConfig([
			{ files: ["**", "!**/generated"], reason: REASON, rules: ["biome/files/includes"] },
			{ files: ["**", "!**/fixtures"], reason: REASON, rules: ["biome/files/includes"] },
		]);

		yield* assertThat(config, (actual) => actual.toEqual({ includes: ["**", "!**/generated", "!**/fixtures"], overrides: [] }));
	});
});
