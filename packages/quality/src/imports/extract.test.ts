import { describe, expect, it } from "vitest";
import { importsOf } from "#imports/extract.ts";
import { sourceSyntax } from "#test/sourceSyntax.ts";

describe("import requests", () => {
	it("reads CommonJS import assignments and preserves type-only assignments", () => {
		const source = sourceSyntax('import tool = require("tool");\nimport type Tool = require("tool-types");');
		expect(importsOf(source, false)).toEqual([
			{ kind: "import", line: 1, specifier: "tool", type: false },
			{ kind: "import", line: 2, specifier: "tool-types", type: true },
		]);
	});

	it("checks package resolvers without treating an application's resolve method as a loader", () => {
		const source = sourceSyntax(
			'const text = "require(";\nservice.resolve("customer");\nservice.require("customer");\nrequire.resolve("tool");\nimport.meta.resolve("tool-types");',
		);
		expect(importsOf(source, false)).toEqual([
			{ kind: "resolve", line: 4, specifier: "tool", type: false },
			{ kind: "resolve", line: 5, specifier: "tool-types", type: false },
		]);
	});
});
