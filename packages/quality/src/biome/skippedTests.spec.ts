import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { biomeReport } from "#biome/report.ts";
import { linkPackage, removeSeededTrees, seedTree } from "#test/tree.ts";

const RULE = "lint/suspicious/noSkippedTests";
const SOURCE = [
	'import { describe, it, test, xdescribe, xit, xtest } from "vitest";',
	'it.skip("leaves evidence missing", () => {});',
	'test.skip("leaves evidence missing", () => {});',
	'describe.skip("leaves evidence missing", () => {});',
	'xit("leaves evidence missing", () => {});',
	'xtest("leaves evidence missing", () => {});',
	'xdescribe("leaves evidence missing", () => {});',
	'const databaseUrl = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");',
	"const integration = test.skipIf(databaseUrl === undefined);",
	'integration("persists an order in PostgreSQL", () => runPostgres(databaseUrl));',
	'it("provides evidence", () => {});',
].join("\n");

afterEach(removeSeededTrees);

function repository(): string {
	const root = seedTree([
		{ content: '{ "extends": ["@shivaedev/quality/biome"] }\n', path: "biome.json" },
		{ content: "node_modules/\n", path: ".gitignore" },
		{ content: SOURCE, path: "src/evidence.test.ts" },
	]);
	linkPackage(root);
	return root;
}

describe("skipped tests in the Biome preset", () => {
	it("reports unconditional skips as errors and permits the PostgreSQL URL gate", async () => {
		const report = await biomeReport(repository(), ["lint"]);
		const skips = report.diagnostics.filter((diagnostic) => diagnostic.category === RULE);
		expect(skips.map((diagnostic) => ({ line: diagnostic.location.start?.line, severity: diagnostic.severity }))).toEqual(
			[2, 3, 4, 5, 6, 7].map((line) => ({ line, severity: "error" })),
		);
	});

	it("preserves skipped test registration when unsafe fixes run", async () => {
		const root = repository();
		const report = await biomeReport(root, ["lint", "--write", "--unsafe", `--only=${RULE}`]);
		expect(report.summary.changed).toBe(0);
		expect(report.diagnostics.filter((diagnostic) => diagnostic.category === RULE)).toHaveLength(6);
		expect(readFileSync(join(root, "src/evidence.test.ts"), "utf8")).toBe(SOURCE);
	});
});
