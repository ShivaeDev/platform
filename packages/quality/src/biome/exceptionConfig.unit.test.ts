import { describe, expect, it } from "vitest";
import { exceptionConfig } from "./exceptionConfig.ts";

const REASON = "The external format requires it.";

describe("exceptionConfig", () => {
	it("turns each declared Biome lint rule and assist action off for its files and ignores quality's own rules", () => {
		const config = exceptionConfig([
			{
				files: ["src/parse.ts"],
				reason: REASON,
				rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny", "biome/assist/source/useSortedKeys"],
			},
		]);

		expect(config).toEqual({
			includes: [],
			overrides: [
				{ includes: ["src/parse.ts"], linter: { rules: { suspicious: { noExplicitAny: "off" } } } },
				{ assist: { actions: { source: { useSortedKeys: "off" } } }, includes: ["src/parse.ts"] },
			],
		});
	});

	it("joins the directory exclusions of several declarations behind one leading **", () => {
		const config = exceptionConfig([
			{ files: ["**", "!**/generated"], reason: REASON, rules: ["biome/files/includes"] },
			{ files: ["**", "!**/fixtures"], reason: REASON, rules: ["biome/files/includes"] },
		]);

		expect(config).toEqual({ includes: ["**", "!**/generated", "!**/fixtures"], overrides: [] });
	});
});
