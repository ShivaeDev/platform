import { afterEach, describe, expect, it } from "vitest";
import { trees } from "#test/cli.ts";
import { commits, gitIn, hookRepository, quality, stages, withPreCommit, withWorktree, writes } from "#test/hookRepository.ts";
import { removeSeededTrees } from "#test/tree.ts";

const CLI_TIMEOUT = 60_000;
const COMMIT_AGAIN =
	"help: fix what the output above reports, then commit again; `quality hooks pre-commit` repeats these checks without committing.";

afterEach(removeSeededTrees);

function installedIn(root: string): string {
	quality(root, "hooks", "install");
	return root;
}

function withDebt(): string {
	const root = hookRepository({ files: trees.dirty.slice(1), preCommit: "{ tighten: true }" }).root;
	quality(root, "baseline", "write");
	stages(root, "quality/baseline.jsonl");
	commits(root, "Record the debt");
	return installedIn(root);
}

describe("the pre-commit hook", { timeout: CLI_TIMEOUT }, () => {
	it("rejects a commit that breaks a rule, says what failed and how to go on", () => {
		const root = installedIn(hookRepository().root);
		writes(root, "src/full.ts", "export const a = 1;\nexport const b = 2;\nexport const c = 3;\nexport const d = 4;\n");
		stages(root, "src/full.ts");

		const result = commits(root, "Too long");

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("src/full.ts  4 lines exceeds the 3-line limit.");
		expect(result.stderr.endsWith(`quality: pre-commit failed: quality lint.\n${COMMIT_AGAIN}\n`)).toBe(true);
		expect(gitIn(root, "log", "--format=%s")).toBe("Base\n");
	});

	it("runs each preCommit.run command after lint, from the config's folder", () => {
		const root = installedIn(hookRepository({ preCommit: '{ run: ["test -f quality.config.ts", "echo typechecked"] }' }).root);

		const result = commits(root, "Clean");

		expect(result.status).toBe(0);
		expect(result.stderr).toContain("quality: passed.");
		expect(result.stderr).toContain("quality: running `test -f quality.config.ts`\nquality: running `echo typechecked`\ntypechecked\n");
	});

	it("runs every check after one fails, and names each that failed", () => {
		const root = installedIn(hookRepository({ preCommit: '{ run: ["exit 3", "echo still ran"] }' }).root);
		writes(root, "src/full.ts", "export const a = 1;\nexport const b = 2;\nexport const c = 3;\nexport const d = 4;\n");
		stages(root, "src/full.ts");

		const result = commits(root, "Too long");

		expect(result.stderr).toContain("still ran\n");
		expect(result.stderr.endsWith(`quality: pre-commit failed: quality lint, \`exit 3\` (exit code 3).\n${COMMIT_AGAIN}\n`)).toBe(true);
	});

	it("checks each worktree's commits under that worktree's own config", () => {
		const repository = hookRepository();
		installedIn(repository.root);
		const worktree = withPreCommit(withWorktree(repository, "stricter"), '{ run: ["exit 4"] }');

		expect(commits(worktree, "Stricter").stderr).toContain("quality: pre-commit failed: `exit 4` (exit code 4).");
		expect(commits(repository.root, "Unchanged").status).toBe(0);
	});
});

describe("the pre-commit hook with preCommit.tighten", { timeout: CLI_TIMEOUT }, () => {
	it("lowers the baseline entries of committed files and commits the baseline with them", () => {
		const root = withDebt();
		writes(root, "src/long.ts", "1\n");
		stages(root, "src/long.ts");

		expect(commits(root, "Fix long").status).toBe(0);
		expect(gitIn(root, "show", "HEAD:quality/baseline.jsonl")).toBe('{"path":"src/longer.ts","rule":"structure/max-lines","count":3}\n');
		expect(gitIn(root, "status", "--porcelain")).toBe("");
	});

	it("leaves the entries of a partly staged file for a later commit", () => {
		const root = withDebt();
		writes(root, "src/longer.ts", "1\n2\n3\n4\n5\n");
		stages(root, "src/longer.ts");
		writes(root, "src/longer.ts", "1\n");

		expect(commits(root, "Shorten longer").status).toBe(0);
		expect(gitIn(root, "show", "HEAD:quality/baseline.jsonl")).toContain('{"path":"src/longer.ts","rule":"structure/max-lines","count":3}');
	});

	it("leaves a baseline with unstaged changes as it is", () => {
		const root = withDebt();
		writes(root, "src/long.ts", "1\n");
		stages(root, "src/long.ts");
		writes(root, "quality/baseline.jsonl", `${gitIn(root, "show", "HEAD:quality/baseline.jsonl")}\n`);

		const result = commits(root, "Fix long");

		expect(result.status).toBe(0);
		expect(result.stderr).toContain(
			"quality: left quality/baseline.jsonl as it is, because it has unstaged changes.\nhelp: stage or discard them to tighten it.",
		);
		expect(gitIn(root, "show", "HEAD:quality/baseline.jsonl")).toContain('"path":"src/long.ts"');
	});
});
