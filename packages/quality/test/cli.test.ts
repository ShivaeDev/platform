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
					'const todo = defineRule({ id: "local/no-todo", description: "Resolve TODOs before merging.",',
					'  check: ({ sources }) => sources.filter((file) => file.text.includes("TODO")).map((file) => ({ file: file.path, message: "has a TODO." })) });',
					'export default defineConfig({ local: [todo], sources: ["src"] });',
				].join("\n"),
				path: "quality.config.ts",
			},
			{ content: "// TODO: later\n", path: "src/todo.ts" },
		]);
		linkPackage(root);
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error local/no-todo (1)\n  Resolve TODOs before merging.\n  src/todo.ts  has a TODO.");
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
		expect(quality(root, "baseline", "write")).toMatchObject({ status: 0, stdout: "quality: recorded 2 entries in quality/baseline.json.\n" });
		expect(quality(root, "lint")).toMatchObject({ status: 0, stdout: expect.stringContaining("2 baselined violations not shown") });

		writeFileSync(join(root, "src/longer.ts"), "1\n2\n3\n4\n5\n6\n7\n");
		const grown = quality(root, "lint");
		expect(grown.status).toBe(1);
		expect(grown.stdout).toContain("src/longer.ts is over its baseline: 1 violation measuring 7 against 1 violation measuring 6 baselined.");

		writeFileSync(join(root, "src/longer.ts"), "1\n2\n3\n4\n5\n");
		writeFileSync(join(root, "src/long.ts"), "1\n");
		const improved = quality(root, "lint");
		expect(improved.status).toBe(1);
		expect(improved.stdout).toContain("structure/max-lines src/long.ts has no violations left.");
		expect(improved.stdout).toContain("structure/max-lines src/longer.ts allows more than is left");

		expect(quality(root, "baseline", "prune").stdout).toBe("quality: removed 1 entry and lowered 1 entry in quality/baseline.json.\n");
		expect(quality(root, "lint").status).toBe(0);
	});

	it("refuses to regenerate an existing baseline", () => {
		const root = seedTree(trees.dirty, [{ content: "{}\n", path: "quality/baseline.json" }]);
		const result = quality(root, "baseline", "write");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("a baseline exists and only shrinks");
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
		["with an unreadable baseline", [config("{}"), { content: "[]", path: "quality/baseline.json" }], "quality/baseline.json is invalid"],
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
