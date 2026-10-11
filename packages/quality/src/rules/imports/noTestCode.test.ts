import { afterEach, describe, expect, it } from "vitest";
import { noTestCode } from "#rules/imports/noTestCode.ts";
import { findingsIn } from "#test/imports.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("imports/no-test-code", () => {
	it.each([
		["static imports", 'import { fixture } from "./fixture.test.ts";', "src/fixture.test.ts"],
		["spec files", 'import { fixture } from "./fixture.spec.ts";', "src/fixture.spec.ts"],
		["DOM tests", 'import { fixture } from "./fixture.dom.test.tsx";', "src/fixture.dom.test.tsx"],
		["type imports", 'import type { Fixture } from "./fixture.typecheck.test.ts";', "src/fixture.typecheck.test.ts"],
		["re-exports", 'export { fixture } from "./test-support/fixture.ts";', "src/test-support/fixture.ts"],
		["type re-exports", 'export type { Fixture } from "./test-support/fixture.ts";', "src/test-support/fixture.ts"],
		["dynamic imports", 'const loaded = import("./test-support/fixture.ts");', "src/test-support/fixture.ts"],
		["require calls", 'const loaded = require("./test-support/fixture.cjs");', "src/test-support/fixture.cjs"],
		["nested test support", 'import { fixture } from "./test-support/nested/fixture.ts";', "src/test-support/nested/fixture.ts"],
		["test assets", 'import fixture from "./test-support/fixture.json";', "src/test-support/fixture.json"],
	])("rejects %s from production and names the repair", async (_, content, path) => {
		const root = seedTree([
			{ content, path: "src/app.ts" },
			{ content: path.endsWith(".json") ? "{}" : "export const fixture = 1; export type Fixture = number;", path },
		]);
		expect(await findingsIn(noTestCode, undefined, root)).toEqual([
			{
				file: "src/app.ts",
				line: 1,
				message: expect.stringContaining("Move the shared code into a production module and import it from both production and tests."),
				subject: expect.any(String),
			},
		]);
	});

	it("checks resolved aliases and missing paths under test-support", async () => {
		const root = seedTree([
			{ content: '{ "imports": { "#kit/*": "./src/test-support/*" } }', path: "package.json" },
			{ content: 'import { fixture } from "#kit/fixture.ts";\nimport "./test-support/missing.ts";', path: "src/app.ts" },
			{ content: "export const fixture = 1;", path: "src/test-support/fixture.ts" },
		]);
		expect((await findingsIn(noTestCode, undefined, root)).map(({ line, subject }) => [line, subject])).toEqual([
			[1, "#kit/fixture.ts"],
			[2, "./test-support/missing.ts"],
		]);
	});

	it("allows production imports and test importers, including test-support modules", async () => {
		const root = seedTree([
			{ content: 'import { shared } from "./shared.ts";', path: "src/app.ts" },
			{ content: "export const shared = 1;", path: "src/shared.ts" },
			{ content: 'import "./test-support/fixture.ts";\nimport "./app.ts";', path: "src/app.slow.test.ts" },
			{ content: 'import "../app.slow.test.ts";\nimport "../app.ts";', path: "src/test-support/fixture.ts" },
		]);
		expect(await findingsIn(noTestCode, undefined, root)).toEqual([]);
		expect(noTestCode.registrable).toBe(false);
	});
});
