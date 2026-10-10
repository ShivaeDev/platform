import { describe, expect, it } from "vitest";
import { specifierSites } from "#imports/specifiers.ts";
import { sourceSyntax } from "#test/sourceSyntax.ts";

describe("specifier sites", () => {
	it("finds CommonJS assignments, import types and loaders, leaving application calls alone", () => {
		const source = sourceSyntax(
			'import tool = require("tool");\nimport type Tool = require("tool-types");\ntype Result = import("result").Result;\nservice.load("customer");\nvi.mock("mocked");',
		);
		expect(specifierSites(source).map(({ line, specifier, type }) => ({ line, specifier, type }))).toEqual([
			{ line: 1, specifier: "tool", type: false },
			{ line: 2, specifier: "tool-types", type: true },
			{ line: 3, specifier: "result", type: true },
			{ line: 5, specifier: "mocked", type: false },
		]);
	});
});
