import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { quality, trees } from "./support/cli.ts";
import { branchOff, commitAll, git } from "./support/git.ts";
import { removeSeededTrees, seedTree } from "./support/tree.ts";

const cliTimeout = 60_000;

afterEach(removeSeededTrees);

const baseline = (root: string): string => readFileSync(join(root, "quality/baseline.jsonl"), "utf8");

const shrunkTwice = (): string => {
	const root = seedTree(trees.dirty);
	quality(root, "baseline", "write");
	branchOff(root);
	writeFileSync(join(root, "src/long.ts"), "1\n");
	writeFileSync(join(root, "src/longer.ts"), "1\n2\n3\n4\n5\n");
	return root;
};

describe("quality baseline tighten", { timeout: cliTimeout }, () => {
	it("with --staged, lowers and removes only the entries of staged files", () => {
		const root = shrunkTwice();
		git(root, "add", "src/long.ts");
		expect(quality(root, "baseline", "tighten", "--staged").stdout).toBe(
			"quality: removed 1 entry and lowered 0 entries in quality/baseline.jsonl.\n",
		);
		expect(baseline(root)).toBe('{"path":"src/longer.ts","rule":"structure/max-lines","count":1,"measure":6}\n');
		expect(quality(root, "lint").status).toBe(0);
	});

	it("without --staged, covers every file changed since HEAD", () => {
		const root = shrunkTwice();
		expect(quality(root, "baseline", "tighten").stdout).toBe("quality: removed 1 entry and lowered 1 entry in quality/baseline.jsonl.\n");
		expect(baseline(root)).toBe('{"path":"src/longer.ts","rule":"structure/max-lines","count":1,"measure":5}\n');
	});

	it("drops the entries of a deleted file", () => {
		const root = shrunkTwice();
		git(root, "rm", "--quiet", "--force", "src/longer.ts");
		expect(quality(root, "baseline", "tighten", "--staged").stdout).toBe(
			"quality: removed 1 entry and lowered 0 entries in quality/baseline.jsonl.\n",
		);
	});

	it("leaves a baseline that changed files do not touch as it is", () => {
		const root = seedTree(trees.dirty);
		quality(root, "baseline", "write");
		branchOff(root);
		expect(quality(root, "baseline", "tighten", "--staged").stdout).toBe("quality: quality/baseline.jsonl is current.\n");
	});
});

describe("quality baseline prune", { timeout: cliTimeout }, () => {
	it("carries the entry of a file moved since the merge base", () => {
		const root = seedTree(trees.dirty);
		quality(root, "baseline", "write");
		branchOff(root);
		git(root, "mv", "src/longer.ts", "src/a-longer.ts");
		commitAll(root, "Move");
		expect(quality(root, "baseline", "prune", "--against", "main").stdout).toBe(
			"quality: removed 0 entries, lowered 0 entries and carried 1 entry to moved files in quality/baseline.jsonl.\n",
		);
		expect(baseline(root)).toBe(
			[
				'{"path":"src/a-longer.ts","rule":"structure/max-lines","count":1,"measure":6}',
				'{"path":"src/long.ts","rule":"structure/max-lines","count":1,"measure":4}',
				"",
			].join("\n"),
		);
	});

	it("still prunes outside git, and says that moves are not followed", () => {
		const root = seedTree(trees.dirty);
		quality(root, "baseline", "write");
		writeFileSync(join(root, "src/long.ts"), "1\n");
		const result = quality(root, "baseline", "prune");
		expect(result).toMatchObject({ status: 0, stdout: "quality: removed 1 entry and lowered 0 entries in quality/baseline.jsonl.\n" });
		expect(result.stderr).toContain("quality: moved files are not followed:");
	});
});
