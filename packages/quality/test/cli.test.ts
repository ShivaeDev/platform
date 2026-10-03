import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality, trees } from "./support/cli.ts";
import { config, linkPackage, removeSeededTrees, seedTree } from "./support/tree.ts";

const cliTimeout = 60_000;

afterEach(removeSeededTrees);

describe("quality lint", { timeout: cliTimeout }, () => {
	it("exits 0 on a clean tree, skipping declarations and ignored files", () => {
		const result = quality(seedTree(trees.clean), "lint");
		expect(result).toEqual({ status: 0, stderr: "", stdout: "quality: passed. 3 source files checked.\n" });
	});

	it("exits 0 when a rule at warn reports", () => {
		const result = quality(seedTree(trees.warned));
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("warn structure/max-lines (1)");
	});

	it("exits 1 and groups the violations of a rule", () => {
		const result = quality(seedTree(trees.dirty), "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error structure/max-lines (2)\n");
		expect(result.stdout).toContain("  src/long.ts  4 lines exceeds the 3-line limit.\n  src/longer.ts  6 lines exceeds the 3-line limit.");
		expect(result.stdout).toContain("quality: failed with 2 errors.");
		expect(result.stderr).toBe("");
	});

	it("runs local rules from a typed config that imports the package", () => {
		const root = seedTree(trees.clean, [
			{
				content: [
					'import { defineConfig, defineRule } from "@shivaedev/quality";',
					'const noLog = defineRule({ id: "local/no-console-log", description: "Log through the logger.",',
					'  check: ({ sources }) => sources.filter((file) => file.text.includes("console.log")).map((file) => ({ file: file.path, message: "logs to the console." })) });',
					'export default defineConfig({ local: [noLog], sources: ["src"] });',
				].join("\n"),
				path: "quality.config.ts",
			},
			{ content: 'console.log("ready");\n', path: "src/log.ts" },
		]);
		linkPackage(root);
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error local/no-console-log (1)\n  Log through the logger.\n  src/log.ts  logs to the console.");
	});

	it("runs the comment rules by default, at the line of each comment", () => {
		const root = seedTree([config('{ sources: ["src"] }'), { content: "/** Adds. */\nexport const a = 1; // TODO\n// three\n", path: "src/a.ts" }]);
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("  src/a.ts:1  JSDoc block.");
		expect(result.stdout).toContain('  src/a.ts:2  Marks unfinished work: "TODO".');
		expect(result.stdout).toContain("  src/a.ts:3  3 comments against a limit of 2.");
	});

	it("honours registered exceptions and fails on stale ones", () => {
		const root = seedTree(trees.dirty, [
			{
				content: JSON.stringify([
					{ file: "src/long.ts", reason: "Generated from the schema.", rule: "structure/max-lines" },
					{ file: "src/longer.ts", reason: "Generated from the schema.", rule: "structure/max-lines" },
				]),
				path: "quality/registry.json",
			},
		]);
		expect(quality(root, "lint").stdout).toContain("quality: passed. 3 source files checked; 2 registered violations not shown.");
		writeFileSync(join(root, "src/long.ts"), "1\n");
		const stale = quality(root, "lint");
		expect(stale.status).toBe(1);
		expect(stale.stdout).toContain("structure/max-lines src/long.ts matches no violation.");
	});
});

describe("quality baseline", { timeout: cliTimeout }, () => {
	it("adopts existing violations, holds them and shrinks with the code", () => {
		const root = seedTree(trees.dirty);
		expect(quality(root, "baseline", "write")).toMatchObject({ status: 0, stdout: "quality: recorded 2 entries in quality/baseline.jsonl.\n" });
		expect(quality(root, "lint")).toMatchObject({ status: 0, stdout: expect.stringContaining("2 baselined violations not shown") });

		writeFileSync(join(root, "src/longer.ts"), "1\n2\n3\n4\n5\n6\n7\n");
		const grown = quality(root, "lint");
		expect(grown.status).toBe(1);
		expect(grown.stdout).toContain("src/longer.ts is over its baseline: 4 against 3 baselined.");

		writeFileSync(join(root, "src/longer.ts"), "1\n2\n3\n4\n5\n");
		writeFileSync(join(root, "src/long.ts"), "1\n");
		const improved = quality(root, "lint");
		expect(improved.status).toBe(0);
		expect(improved.stdout).toContain("note quality/baseline.jsonl: 2 stale entries");
		expect(improved.stdout).toContain("structure/max-lines src/long.ts has no violations left.");
		expect(improved.stdout).toContain("structure/max-lines src/longer.ts allows more than is left");

		expect(quality(root, "baseline", "prune").stdout).toBe("quality: removed 1 entry and lowered 1 entry in quality/baseline.jsonl.\n");
		expect(quality(root, "lint")).toMatchObject({ status: 0, stdout: expect.not.stringContaining("note") });
	});

	it("refuses to regenerate an existing baseline without naming a rule", () => {
		const root = seedTree(trees.dirty, [{ content: "", path: "quality/baseline.jsonl" }]);
		const result = quality(root, "baseline", "write");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("a baseline exists. Record a rule with --rule <id>");
	});
});

describe("quality exits 2 when it cannot run", { timeout: cliTimeout }, () => {
	it.each([
		["without a config", [], "no config at"],
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
	])("%s", (_, files, message) => {
		const result = quality(seedTree(files), "lint");
		expect(result.status).toBe(2);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain(message);
	});

	it("on a usage error, printing the usage", () => {
		const result = quality(seedTree(trees.clean), "lint", "--warnings", "loud");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("Usage:");
	});
});
