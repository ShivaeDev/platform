import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { specifierSites } from "#imports/specifiers.ts";
import { sourceSyntax } from "#test/sourceSyntax.ts";

describe("specifier sites", () => {
	it.effect("finds CommonJS assignments, import types and test loaders, and leaves an application's own calls alone", function* () {
		const source = sourceSyntax(
			'import tool = require("tool");\nimport type Tool = require("tool-types");\ntype Result = import("result").Result;\nservice.load("customer");\nvi.mock("mocked");',
		);

		yield* assertThat(
			specifierSites(source).map(({ line, specifier, type }) => ({ line, specifier, type })),
			(actual) =>
				actual.toEqual([
					{ line: 1, specifier: "tool", type: false },
					{ line: 2, specifier: "tool-types", type: true },
					{ line: 3, specifier: "result", type: true },
					{ line: 5, specifier: "mocked", type: false },
				]),
		);
	});
});
