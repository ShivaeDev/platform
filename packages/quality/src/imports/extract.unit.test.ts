import { describe } from "@effect/vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { importsOf } from "#imports/extract.ts";
import { sourceSyntax } from "#test/sourceSyntax.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

describe("import requests", () => {
	it.effect("reads CommonJS import assignments and keeps a type-only assignment type-only", function* () {
		const source = sourceSyntax('import tool = require("tool");\nimport type Tool = require("tool-types");');

		yield* assertThat(importsOf(source, false), (actual) =>
			actual.toEqual([
				{ kind: "import", line: 1, specifier: "tool", type: false },
				{ kind: "import", line: 2, specifier: "tool-types", type: true },
			]),
		);
	});

	it.effect("reads require.resolve and import.meta.resolve, but not a string or an application's own resolve and require methods", function* () {
		const source = sourceSyntax(
			'const text = "require(";\nservice.resolve("customer");\nservice.require("customer");\nrequire.resolve("tool");\nimport.meta.resolve("tool-types");',
		);

		yield* assertThat(importsOf(source, false), (actual) =>
			actual.toEqual([
				{ kind: "resolve", line: 4, specifier: "tool", type: false },
				{ kind: "resolve", line: 5, specifier: "tool-types", type: false },
			]),
		);
	});
});
