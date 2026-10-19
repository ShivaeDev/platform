import { afterEach, describe, expect, it } from "vitest";
import { FIXED, ignoringEveryFile, MESSY, messyText, messyWorktree } from "#test/biomeWorktrees.ts";
import { CLI_EXIT, runQuality } from "#test/cli.ts";
import { installedIn } from "#test/commitActions.ts";
import { commits, quality, stages } from "#test/hookRepository.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("Biome in a linked worktree under .worktrees", { timeout: 60_000 }, () => {
	it.each(["", "app"])("reports a misformatted file and an unsorted import in the project at %j", (folder) => {
		const { worktree } = messyWorktree(folder);
		const result = quality(worktree, "lint");
		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stdout).toContain("error biome/format (1)");
		expect(result.stdout).toContain(`${MESSY.path}  Is not formatted. Run \`quality fix\`.`);
		expect(result.stdout).toContain("error biome/assist/source/organizeImports (1)");
	});

	it("rejects the commit in the pre-commit hook", async () => {
		const { repository, worktree } = messyWorktree();
		await installedIn(repository.root);
		stages(worktree, MESSY.path);
		const result = commits(worktree, "Messy");
		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stderr).toContain(`${MESSY.path}  Is not formatted. Run \`quality fix\`.`);
	});

	it("fixes the format and the import order", () => {
		const { worktree } = messyWorktree();
		expect(quality(worktree, "fix").status).toBe(CLI_EXIT.passed);
		expect(messyText(worktree)).toBe(FIXED);
		expect(quality(worktree, "lint")).toMatchObject({ status: CLI_EXIT.passed, stdout: expect.stringContaining("quality: passed.") });
	});

	it("stays out of the primary checkout's lint and fix", () => {
		const { primary, worktree } = messyWorktree();
		expect(quality(primary, "lint")).toMatchObject({ status: CLI_EXIT.passed, stdout: expect.stringContaining("quality: passed.") });
		expect(quality(primary, "fix").status).toBe(CLI_EXIT.passed);
		expect(messyText(worktree)).toBe(MESSY.content);
	});

	it.each(["lint", "fix"])("fails %s with Biome's message when its config leaves no file to check", async (command) => {
		const { worktree } = messyWorktree();
		const result = await runQuality(ignoringEveryFile(worktree), command);
		expect(result.status).toBe(CLI_EXIT.invalid);
		expect(result.stderr).toContain("exited 1 without a failing diagnostic:");
		expect(result.stderr).toContain("No files were processed in the specified paths.");
		expect(messyText(worktree)).toBe(MESSY.content);
	});
});
