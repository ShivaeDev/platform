import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality, runQuality, trees } from "#test/cli.ts";
import { formatTree, qualityTree } from "#test/qualityTree.ts";
import { config, removeSeededTrees, seedTree } from "#test/tree.ts";

const CLI_TIMEOUT = 60_000;

afterEach(removeSeededTrees);

describe("quality lint", { timeout: CLI_TIMEOUT }, () => {
	it("exits 0 on a clean tree, skipping declarations and ignored files", async () => {
		const result = await runQuality(qualityTree(trees.clean), "lint");
		expect(result).toEqual({ status: 0, stderr: "", stdout: "quality: passed. 3 source files checked.\n" });
	});

	it.each(["warn", "off"])("exits 2 when a config tries to use %s", async (level) => {
		const result = await runQuality(seedTree([config(`{ rules: { "structure/max-lines": "${level}" } }`)]));
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("structure/max-lines");
	});

	it("exits 1 from the executable and groups the violations of a rule", () => {
		const result = quality(qualityTree(trees.dirty), "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error structure/max-lines (2)\n");
		expect(result.stdout).toContain("  src/long.ts  4 lines exceeds the 3-line limit.");
		expect(result.stdout).toContain("  src/longer.ts  6 lines exceeds the 3-line limit.");
		expect(result.stdout).toContain("quality: failed with 2 errors.");
		expect(result.stderr).toBe("");
	});

	it("runs local rules from a typed config that imports the package", async () => {
		const root = qualityTree(trees.clean, [
			{
				content: [
					'import { defineConfig } from "@shivaedev/quality/config.ts";',
					'import { defineRule } from "@shivaedev/quality/rule.ts";',
					'const noLog = defineRule({ id: "local/no-console-log", description: "Log through the logger.",',
					'  check: ({ sources }) => sources.filter((file) => file.text.includes("console.log")).map((file) => ({ file: file.path, message: "logs to the console." })) });',
					'export default defineConfig({ local: [noLog], sources: ["src"] });',
				].join("\n"),
				path: "quality.config.ts",
			},
			{ content: 'console.log("ready");\n', path: "src/log.ts" },
		]);
		const result = await runQuality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error local/no-console-log (1)\n  Log through the logger.\n  src/log.ts  logs to the console.");
	});

	it("runs the comment rules by default, at the line of each comment", async () => {
		const root = seedTree([config('{ sources: ["src"] }'), { content: "/** Adds. */\nexport const a = 1; // TODO\n// three\n", path: "src/a.ts" }]);
		const result = await runQuality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("  src/a.ts:1  JSDoc block.");
		expect(result.stdout).toContain('  src/a.ts:2  Marks unfinished work: "TODO".');
		expect(result.stdout).toContain("  src/a.ts:3  3 comments against a limit of 2.");
	});

	it("honours registered exceptions and fails on stale ones", async () => {
		const root = qualityTree(trees.dirty, [
			{
				content: JSON.stringify([
					{ file: "src/long.ts", reason: "Generated from the schema.", rule: "structure/max-lines" },
					{ file: "src/longer.ts", reason: "Generated from the schema.", rule: "structure/max-lines" },
				]),
				path: "quality/registry.json",
			},
		]);
		expect((await runQuality(formatTree(root), "lint")).stdout).toContain(
			"quality: passed. 3 source files checked; 2 registered violations not shown.",
		);
		writeFileSync(join(root, "src/long.ts"), "String(0);\n");
		const stale = await runQuality(root, "lint");
		expect(stale.status).toBe(1);
		expect(stale.stdout).toContain("structure/max-lines src/long.ts matches no violation.");
	});
});

describe("quality baseline", { timeout: CLI_TIMEOUT }, () => {
	it("adopts existing violations, holds them and shrinks with the code", async () => {
		const root = qualityTree(trees.dirty);
		expect(await runQuality(root, "baseline", "write")).toMatchObject({
			status: 0,
			stdout: "quality: recorded 2 entries in quality/baseline.jsonl.\n",
		});
		expect(await runQuality(root, "lint")).toMatchObject({ status: 0, stdout: expect.stringContaining("2 baselined violations not shown") });

		writeFileSync(join(root, "src/longer.ts"), "String(0);\nString(1);\nString(2);\nString(3);\nString(4);\nString(5);\nString(6);\n");
		const grown = await runQuality(root, "lint");
		expect(grown.status).toBe(1);
		expect(grown.stdout).toContain("src/longer.ts is over its baseline: 4 against 3 baselined.");

		writeFileSync(join(root, "src/longer.ts"), "String(0);\nString(1);\nString(2);\nString(3);\nString(4);\n");
		writeFileSync(join(root, "src/long.ts"), "String(0);\n");
		const improved = await runQuality(root, "lint");
		expect(improved.status).toBe(0);
		expect(improved.stdout).toContain("note quality/baseline.jsonl: 2 stale entries");
		expect(improved.stdout).toContain("structure/max-lines src/long.ts has no violations left.");
		expect(improved.stdout).toContain("structure/max-lines src/longer.ts allows more than is left");

		expect((await runQuality(root, "baseline", "prune")).stdout).toBe("quality: removed 1 entry and lowered 1 entry in quality/baseline.jsonl.\n");
		expect(await runQuality(root, "lint")).toMatchObject({ status: 0, stdout: expect.not.stringContaining("note") });
	});

	it("refuses to regenerate an existing baseline without naming a rule", async () => {
		const root = qualityTree(trees.dirty, [{ content: "", path: "quality/baseline.jsonl" }]);
		const result = await runQuality(root, "baseline", "write");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("a baseline exists. Record a rule with --rule <id>");
	});
});

describe("quality exits 2 when it cannot run", { timeout: CLI_TIMEOUT }, () => {
	it.each([
		["with a broken config", [{ content: "export default {", path: "quality.config.ts" }], "cannot load"],
		[
			"with an invalid config",
			[config('{ rules: { "structure/max-line": "error" } }')],
			"rules.structure/max-line: no built-in or local rule has this id",
		],
		["with a missing source", [config('{ sources: ["srcc"] }')], 'source "srcc" does not exist'],
		["with an unreadable baseline", [config("{}"), { content: "[]", path: "quality/baseline.jsonl" }], "quality/baseline.jsonl is invalid"],
		[
			"with only a baseline in the earlier format",
			[config("{}"), { content: "{}\n", path: "quality/baseline.json" }],
			"Run `quality baseline migrate` to move it to quality/baseline.jsonl",
		],
		[
			"when a rule throws",
			[
				config(
					'{ local: [{ id: "local/boom", description: "Throws.", configure: async () => ({ _tag: "Ready", check: async () => { throw new Error("boom"); } }) }] }',
				),
			],
			"rule local/boom failed: boom",
		],
	])("%s", async (_, files, message) => {
		const result = await runQuality(seedTree(files), "lint");
		expect(result.status).toBe(2);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain(message);
	});

	it("on a usage error, printing the usage", async () => {
		const result = await runQuality(qualityTree(trees.clean), "lint", "--warnings", "loud");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("Usage:");
	});
});
