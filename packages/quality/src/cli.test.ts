import { afterEach, describe, expect, it } from "vitest";
import { exceedLongerBaseline, reduceLongerFile, reduceLongFile } from "#test/baselineChanges.ts";
import { quality, runQuality, trees } from "#test/cli.ts";
import {
	commentedRepository,
	downgradedRuleRepository,
	emptyBaselineRepository,
	invalidRepository,
	localRuleRepository,
	registeredDebtRepository,
} from "#test/cliRepositories.ts";
import { formatTree, qualityTree } from "#test/qualityTree.ts";
import { removeSeededTrees } from "#test/tree.ts";

const CLI_TIMEOUT = 60_000;

afterEach(removeSeededTrees);

describe("quality lint", { timeout: CLI_TIMEOUT }, () => {
	it("exits 0 on a clean tree, skipping declarations and ignored files", async () => {
		const result = await runQuality(qualityTree(trees.clean), "lint");
		expect(result).toEqual({ status: 0, stderr: "", stdout: "quality: passed. 3 source files checked.\n" });
	});

	it.each(["warn", "off"])("exits 2 when a config tries to use %s", async (level) => {
		const result = await runQuality(downgradedRuleRepository(level));
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
		const root = localRuleRepository();
		const result = await runQuality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error local/no-console-log (1)\n  Log through the logger.\n  src/log.ts  logs to the console.");
	});

	it("runs the comment rules by default, at the line of each comment", async () => {
		const root = commentedRepository();
		const result = await runQuality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("  src/a.ts:1  JSDoc block.");
		expect(result.stdout).toContain('  src/a.ts:2  Marks unfinished work: "TODO".');
		expect(result.stdout).toContain("  src/a.ts:3  3 comments against a limit of 2.");
	});

	it("honours registered exceptions and fails on stale ones", async () => {
		const root = registeredDebtRepository();
		expect((await runQuality(formatTree(root), "lint")).stdout).toContain(
			"quality: passed. 3 source files checked; 2 registered violations not shown.",
		);
		reduceLongFile(root);
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
			stdout: "quality: recorded 2 entries in quality-baseline.jsonl.\n",
		});
		expect(await runQuality(root, "lint")).toMatchObject({ status: 0, stdout: expect.stringContaining("2 baselined violations not shown") });

		exceedLongerBaseline(root);
		const grown = await runQuality(root, "lint");
		expect(grown.status).toBe(1);
		expect(grown.stdout).toContain("src/longer.ts is over its baseline: 4 against 3 baselined.");

		reduceLongerFile(root);
		reduceLongFile(root);
		const improved = await runQuality(root, "lint");
		expect(improved.status).toBe(0);
		expect(improved.stdout).toContain("note quality-baseline.jsonl: 2 stale entries");
		expect(improved.stdout).toContain("structure/max-lines src/long.ts has no violations left.");
		expect(improved.stdout).toContain("structure/max-lines src/longer.ts allows more than is left");

		expect((await runQuality(root, "baseline", "prune")).stdout).toBe("quality: removed 1 entry and lowered 1 entry in quality-baseline.jsonl.\n");
		expect(await runQuality(root, "lint")).toMatchObject({ status: 0, stdout: expect.not.stringContaining("note") });
	});

	it("refuses to regenerate an existing baseline without naming a rule", async () => {
		const root = emptyBaselineRepository();
		const result = await runQuality(root, "baseline", "write");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("a baseline exists. Record a rule with --rule <id>");
	});
});

describe("quality exits 2 when it cannot run", { timeout: CLI_TIMEOUT }, () => {
	it.each([
		["brokenConfig", "cannot load"],
		["invalidConfig", "rules.structure/max-line: no built-in or local rule has this id"],
		["missingSource", 'source "srcc" does not exist'],
		["unreadableBaseline", "quality-baseline.jsonl is invalid"],
		["legacyBaseline", "Run `quality baseline migrate --from quality/baseline.json` to move it to quality-baseline.jsonl"],
		["throwingRule", "rule local/boom failed: boom"],
	] as const)("with %s", async (kind, message) => {
		const result = await runQuality(invalidRepository(kind), "lint");
		expect(result.status).toBe(2);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain(message);
	});

	it("rejects warning-report options with usage", () => {
		const result = quality(qualityTree(trees.clean), "lint", "--warnings", "all");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("Unknown option '--warnings'");
		expect(result.stderr).toContain("Usage:\n  quality lint [--config <file>]");
	});
});
