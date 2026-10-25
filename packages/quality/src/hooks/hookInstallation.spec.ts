import { realpathSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_EXIT, runQuality } from "#test/cli.ts";
import { hookPath } from "#test/hookPath.ts";
import { commits, hookRepository, hookText, qualityFrom, withOwnHook, withQualityAt, withWorktree } from "#test/hookRepository.ts";
import { config, removeSeededTrees, seedTree } from "#test/tree.ts";

const CLI_TIMEOUT = 60_000;
const OWNER = "# Installed by @shivaedev/quality: `quality hooks install` writes it, `quality hooks uninstall` removes it.";

afterEach(removeSeededTrees);

describe("quality hooks install", { timeout: CLI_TIMEOUT }, () => {
	it("explains how to initialize a repository before installing a hook", async () => {
		const root = seedTree([config("{}")]);
		expect(await runQuality(root, "hooks", "install")).toEqual({
			status: 2,
			stderr: `quality: ${realpathSync(root)} is not in a git work tree, so there is no hook to manage.\nhelp: run quality from inside the repository, or run \`git init\` first.\n`,
			stdout: "",
		});
	});

	it("installs again over its own hook and says it is up to date", async () => {
		const repository = hookRepository();
		await runQuality(repository.root, "hooks", "install");

		expect((await runQuality(repository.root, "hooks", "install")).stdout).toBe(
			`quality: the pre-commit hook at ${hookPath(repository.root)} is up to date.\nquality: set repository-local core.hooksPath to ${join(hookPath(repository.root), "..")}.\nquality: no executable global pre-commit hook to chain.\n`,
		);
	});

	it("keeps a pre-commit hook that is not quality's and says how to check commits with it", async () => {
		const repository = withOwnHook(hookRepository(), "#!/bin/sh\nmake check\n");

		const result = await runQuality(repository.root, "hooks", "install");

		expect(result.status).toBe(CLI_EXIT.passed);
		expect(result.stderr).toBe(
			`quality: kept ${hookPath(repository.root)}: it is not quality's pre-commit hook, so quality does not check commits.\nhelp: call \`node_modules/.bin/quality hooks pre-commit\` from that hook, or replace it with \`quality hooks install --force\`.\n`,
		);
		expect(hookText(repository)).toBe("#!/bin/sh\nmake check\n");
	});

	it("replaces a pre-commit hook that is not quality's with --force", async () => {
		const repository = withOwnHook(hookRepository(), "#!/bin/sh\nmake check\n");

		expect((await runQuality(repository.root, "hooks", "install", "--force")).stdout).toContain(
			`quality: replaced ${hookPath(repository.root)}, which was not quality's hook;`,
		);
		expect(hookText(repository)).toContain(OWNER);
	});

	it("installs from a linked worktree into the hooks every worktree shares", async () => {
		const repository = hookRepository();
		const worktree = withWorktree(repository, "feature");

		expect((await runQuality(worktree, "hooks", "install")).status).toBe(CLI_EXIT.passed);
		expect(hookText(repository)).toContain(OWNER);
		expect((await runQuality(repository.root, "hooks", "install")).stdout).toContain("is up to date");
	});

	it("runs quality the way install ran it when that is a file in the repository, with the same Node options", () => {
		const repository = hookRepository();
		const local = withQualityAt(repository, "tools/quality.ts");

		qualityFrom(local, repository.root, "hooks", "install");

		expect(hookText(repository)).toContain("quality=tools/quality.ts\n");
		expect(hookText(repository)).toContain('node --conditions=source "$quality" hooks pre-commit || status=$?\n');
		expect(commits(repository.root, "Checked by the repository's own quality").status).toBe(CLI_EXIT.passed);
	});

	it("runs from the folder of a config below the repository root", async () => {
		const repository = hookRepository({ folder: "app", scripts: { "quality:commit": "test -f quality.config.ts" } });

		await runQuality(join(repository.root, "app"), "hooks", "install");

		expect(hookText(repository)).toContain('cd "$top"/app || exit 2\n');
		expect(commits(repository.root, "Checked from app").status).toBe(CLI_EXIT.passed);
	});
});

describe("quality hooks uninstall", { timeout: CLI_TIMEOUT }, () => {
	it("reports that a fresh repository has no hook to uninstall", async () => {
		const repository = hookRepository();
		expect(await runQuality(repository.root, "hooks", "uninstall")).toEqual({
			status: 0,
			stderr: "",
			stdout: `quality: there is no pre-commit hook at ${hookPath(repository.root)}.\n`,
		});
	});
	it("removes quality's hook", async () => {
		const repository = hookRepository();
		await runQuality(repository.root, "hooks", "install");

		expect((await runQuality(repository.root, "hooks", "uninstall")).stdout).toBe(
			`quality: removed the pre-commit hook at ${hookPath(repository.root)}.\n`,
		);
		expect(hookText(repository)).toBeUndefined();
	});

	it("keeps a hook that is not quality's", async () => {
		const repository = withOwnHook(hookRepository(), "#!/bin/sh\nmake check\n");

		expect((await runQuality(repository.root, "hooks", "uninstall")).stderr).toBe(
			`quality: kept ${hookPath(repository.root)}: it is not quality's pre-commit hook.\n`,
		);
		expect(hookText(repository)).toBe("#!/bin/sh\nmake check\n");
	});
});
