import { realpathSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
	commits,
	gitIn,
	hookRepository,
	hookText,
	quality,
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

afterEach(removeSeededTrees);

function installedIn(root: string): string {
	quality(root, "hooks", "install");
	return root;
}

describe("the pre-commit hook", { timeout: CLI_TIMEOUT }, () => {
	it("runs lint alone without a manifest", () => {
		const root = installedIn(withoutManifest(hookRepository().root));
		const result = commits(root, "Lint alone");
		expect(result.status).toBe(0);
		expect(result.stderr).toContain("quality: passed.");
		expect(result.stderr).not.toContain("quality: running");
	});

	it("requires explicit installation and checks a repository without a config", () => {
		const repository = hookRepository({ configless: true, scripts: { typecheck: "echo typechecked" } });
		expect(hookText(repository)).toBeUndefined();
		installedIn(repository.root);
		const result = commits(repository.root, "Clean defaults");
		expect(result.status).toBe(0);
		expect(result.stderr).toContain("typechecked");
		expect(result.stderr).not.toContain("run quality:commit");
	});

	it("runs quality:commit without requiring a typecheck script", () => {
		const root = installedIn(hookRepository({ scripts: { "quality:commit": "echo repository checked" } }).root);
		const result = commits(root, "Repository checks");
		expect(result.status).toBe(0);
		expect(result.stderr).toContain("repository checked");
		expect(result.stderr).not.toContain("run typecheck");
	});

	it("uses the declared package manager", () => {
		const root = installedIn(hookRepository().root);
		withScripts(root, { typecheck: "echo declared manager checked" }, "npm@11.0.0");
		const result = commits(root, "Package manager");
		expect(result.status).toBe(0);
		expect(result.stderr).toContain("quality: running `npm run typecheck`");
		expect(result.stderr).toContain("declared manager checked");
	});

	it("reports a broken manifest instead of omitting repository checks", () => {
		const root = installedIn(hookRepository().root);
		writes(root, "package.json", '{ "scripts": { "typecheck": 3 } }');
		const result = commits(root, "Broken scripts");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("package.json is invalid");
	});

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

	it("runs typecheck and quality:commit after lint, from the config's folder", () => {
		const root = installedIn(
			hookRepository({ scripts: { "quality:commit": "echo repository checked", typecheck: "test -f quality.config.ts && echo typechecked" } }).root,
		);

		const result = commits(root, "Clean");

		expect(result.status).toBe(0);
		expect(result.stderr).toContain("quality: passed.");
		expect(result.stderr).toContain("quality: running `npm run typecheck`");
		expect(result.stderr).toContain("quality: running `npm run quality:commit`");
		expect(result.stderr.indexOf("typechecked\n")).toBeLessThan(result.stderr.indexOf("repository checked\n"));
	});

	it("runs every check after one fails, and names each that failed", () => {
		const root = installedIn(hookRepository({ scripts: { "quality:commit": "echo still ran; exit 4", typecheck: "exit 3" } }).root);
		writes(root, "src/full.ts", "export const a = 1;\nexport const b = 2;\nexport const c = 3;\nexport const d = 4;\n");
		stages(root, "src/full.ts");

		const result = commits(root, "Too long");

		expect(result.stderr).toContain("still ran\n");
		expect(
			result.stderr.endsWith(
				`quality: pre-commit failed: quality lint, \`npm run typecheck\` (exit code 3), \`npm run quality:commit\` (exit code 4).\n${COMMIT_AGAIN}\n`,
			),
		).toBe(true);
	});

	it("checks each worktree's commits under that worktree's own config", () => {
		const repository = hookRepository();
		installedIn(repository.root);
		const worktree = withScripts(withWorktree(repository, "stricter"), { "quality:commit": "exit 4" });

		expect(commits(worktree, "Stricter").stderr).toContain("quality: pre-commit failed: `npm run quality:commit` (exit code 4).");
		expect(commits(repository.root, "Unchanged").status).toBe(0);
	});

	it("rejects a commit from a worktree without its dependencies and says how to go on", () => {
		const repository = hookRepository();
		installedIn(repository.root);
		const worktree = withBareWorktree(repository, "fresh");

		const result = commits(worktree, "Unchecked");

		expect(result.status).toBe(1);
		expect(result.stderr).toBe(
			`quality: cannot check this commit: ${realpathSync(worktree)}/node_modules/.bin/quality does not exist.\nhelp: install the dependencies of this worktree, then commit again.\n`,
		);
	});
});
