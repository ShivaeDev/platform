import { afterEach, describe, expect, it } from "vitest";
import { reduceLongFile } from "#test/baselineChanges.ts";
import { baseline, shrunkTwice } from "#test/baselineTightening.ts";
import { CLI_EXIT, CLI_TIMEOUT, runQuality, trees } from "#test/cli.ts";
import { branchOff, commitAll, git } from "#test/git.ts";
import { qualityTree } from "#test/qualityTree.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("quality baseline tighten", { timeout: CLI_TIMEOUT }, () => {
	it("with --staged, lowers and removes only the entries of staged files", async () => {
		const root = await shrunkTwice();
		git(root, "add", "src/long.ts");
		expect((await runQuality(root, "baseline", "tighten", "--staged")).stdout).toBe(
			"quality: removed 1 entry and lowered 0 entries in quality-baseline.jsonl.\n",
		);
		expect(baseline(root)).toBe('{"path":"src/longer.ts","rule":"structure/max-lines","count":3}\n');
		expect((await runQuality(root, "lint")).status).toBe(CLI_EXIT.passed);
	});

	it("without --staged, covers every file changed since HEAD", async () => {
		const root = await shrunkTwice();
		expect((await runQuality(root, "baseline", "tighten")).stdout).toBe("quality: removed 1 entry and lowered 1 entry in quality-baseline.jsonl.\n");
		expect(baseline(root)).toBe('{"path":"src/longer.ts","rule":"structure/max-lines","count":2}\n');
	});

	it("drops the entries of a deleted file", async () => {
		const root = await shrunkTwice();
		git(root, "rm", "--quiet", "--force", "src/longer.ts");
		expect((await runQuality(root, "baseline", "tighten", "--staged")).stdout).toBe(
			"quality: removed 1 entry and lowered 0 entries in quality-baseline.jsonl.\n",
		);
		expect(baseline(root)).toBe('{"path":"src/long.ts","rule":"structure/max-lines","count":1}\n');
	});

	it("leaves a baseline that changed files do not touch as it is", async () => {
		const root = qualityTree(trees.dirty);
		await runQuality(root, "baseline", "write");
		branchOff(root);
		expect((await runQuality(root, "baseline", "tighten", "--staged")).stdout).toBe("quality: quality-baseline.jsonl is current.\n");
	});
});

describe("quality baseline prune", { timeout: CLI_TIMEOUT }, () => {
	it("carries the entry of a file moved since the merge base", async () => {
		const root = qualityTree(trees.dirty);
		await runQuality(root, "baseline", "write");
		branchOff(root);
		git(root, "mv", "src/longer.ts", "src/a-longer.ts");
		commitAll(root, "Move");
		expect((await runQuality(root, "baseline", "prune", "--against", "main")).stdout).toBe(
			"quality: removed 0 entries, lowered 0 entries and carried 1 entry to moved files in quality-baseline.jsonl.\n",
		);
		expect(baseline(root)).toBe(
			['{"path":"src/a-longer.ts","rule":"structure/max-lines","count":3}', '{"path":"src/long.ts","rule":"structure/max-lines","count":1}', ""].join(
				"\n",
			),
		);
	});

	it("still prunes outside git, and says that moves are not followed", async () => {
		const root = qualityTree(trees.dirty);
		await runQuality(root, "baseline", "write");
		reduceLongFile(root);
		const result = await runQuality(root, "baseline", "prune");
		expect(result).toMatchObject({ status: 0, stdout: "quality: removed 1 entry and lowered 0 entries in quality-baseline.jsonl.\n" });
		expect(result.stderr).toContain("quality: moved files are not followed:");
	});
});
