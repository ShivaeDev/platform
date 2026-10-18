import { realpathSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_EXIT, runQuality } from "#test/cli.ts";
import { installedIn, preCommit } from "#test/commitActions.ts";
import {
	checksLog,
	commits,
	gitIn,
	hookRepository,
	hookText,
	logs,
	stages,
	withBareWorktree,
	withoutManifest,
	withScripts,
	withWorktree,
	writes,
} from "#test/hookRepository.ts";
import { removeSeededTrees } from "#test/tree.ts";

const CLI_TIMEOUT = 60_000;
const COMMIT_AGAIN =
	"help: fix what the output above reports, then commit again; `quality hooks pre-commit` repeats these checks without committing.";
const TOO_LONG = "export const a = 1;\nexport const b = 2;\nexport const c = 3;\nexport const d = 4;\n";

afterEach(removeSeededTrees);

describe("the pre-commit checks", { timeout: CLI_TIMEOUT }, () => {
	it("run lint alone without a manifest", async () => {
		const result = await preCommit(withoutManifest(hookRepository().root));
		expect(result.status).toBe(CLI_EXIT.passed);
		expect(result.stdout).toContain("quality: passed.");
		expect(result.stdout).not.toContain("quality: running");
	});

	it("check a repository without a config, whose hook needs explicit installation", async () => {
		const repository = hookRepository({ configless: true, scripts: { typecheck: logs("typechecked") } });
		expect(hookText(repository)).toBeUndefined();
		expect((await runQuality(repository.root, "hooks", "install")).status).toBe(CLI_EXIT.passed);
		expect(hookText(repository)).toContain('"$quality" hooks pre-commit || status=$?');
		expect((await preCommit(repository.root)).status).toBe(CLI_EXIT.passed);
		expect(checksLog(repository.root)).toBe("typechecked\n");
	});

	it("run quality:commit without requiring a typecheck script", async () => {
		const { root } = hookRepository({ scripts: { "quality:commit": logs("repository checked") } });
		const result = await preCommit(root);
		expect(result.status).toBe(CLI_EXIT.passed);
		expect(result.stdout).not.toContain("run typecheck");
		expect(checksLog(root)).toBe("repository checked\n");
	});

	it("use the declared package manager", async () => {
		const root = withScripts(hookRepository().root, { typecheck: logs("typechecked") }, "npm@11.0.0");
		const result = await preCommit(root);
		expect(result.status).toBe(CLI_EXIT.passed);
		expect(result.stdout).toContain("quality: running `npm run typecheck`");
		expect(checksLog(root)).toBe("typechecked\n");
	});

	it("report a broken manifest instead of omitting repository checks", async () => {
		const { root } = hookRepository();
		writes(root, "package.json", '{ "scripts": { "typecheck": 3 } }');
		const result = await preCommit(root);
		expect(result.status).toBe(CLI_EXIT.invalid);
		expect(result.stderr).toContain("package.json is invalid");
	});

	it("run typecheck and quality:commit after lint, from the config's folder", async () => {
		const { root } = hookRepository({
			scripts: { "quality:commit": logs("repository checked"), typecheck: `test -f quality.config.ts && ${logs("typechecked")}` },
		});

		const result = await preCommit(root);

		expect(result.status).toBe(CLI_EXIT.passed);
		expect(result.stdout).toContain("quality: passed.");
		expect(result.stdout).toContain("quality: running `npm run typecheck`");
		expect(result.stdout).toContain("quality: running `npm run quality:commit`");
		expect(checksLog(root)).toBe("typechecked\nrepository checked\n");
	});

	it("run every check after one fails, and name each that failed", async () => {
		const { root } = hookRepository({ scripts: { "quality:commit": `${logs("still ran")}; exit 4`, typecheck: "exit 3" } });
		writes(root, "src/full.ts", TOO_LONG);

		const result = await preCommit(root);

		expect(checksLog(root)).toBe("still ran\n");
		expect(result.stderr).toBe(
			`quality: pre-commit failed: quality lint, \`npm run typecheck\` (exit code 3), \`npm run quality:commit\` (exit code 4).\n${COMMIT_AGAIN}\n`,
		);
	});
});

describe("the pre-commit hook", { timeout: CLI_TIMEOUT }, () => {
	it("rejects a commit that breaks a rule, says what failed and how to go on", async () => {
		const root = await installedIn(hookRepository().root);
		writes(root, "src/full.ts", TOO_LONG);
		stages(root, "src/full.ts");

		const result = commits(root, "Too long");

		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stderr).toContain("src/full.ts  4 lines exceeds the 3-line limit.");
		expect(result.stderr.endsWith(`quality: pre-commit failed: quality lint.\n${COMMIT_AGAIN}\n`)).toBe(true);
		expect(gitIn(root, "log", "--format=%s")).toBe("Base\n");
	});

	it("checks each worktree's commits under that worktree's own config", async () => {
		const repository = hookRepository();
		await installedIn(repository.root);
		const worktree = withScripts(withWorktree(repository, "stricter"), { "quality:commit": "exit 4" });

		expect(commits(worktree, "Stricter").stderr).toContain("quality: pre-commit failed: `npm run quality:commit` (exit code 4).");
		expect(commits(repository.root, "Unchanged").status).toBe(CLI_EXIT.passed);
	});

	it("rejects a commit from a worktree without its dependencies and says how to go on", async () => {
		const repository = hookRepository();
		await installedIn(repository.root);
		const worktree = withBareWorktree(repository, "fresh");

		const result = commits(worktree, "Unchecked");

		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stderr).toBe(
			`quality: cannot check this commit: ${realpathSync(worktree)}/node_modules/.bin/quality does not exist.\nhelp: install the dependencies of this worktree, then commit again.\n`,
		);
	});
});
