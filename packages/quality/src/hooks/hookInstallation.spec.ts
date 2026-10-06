import { realpathSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	commits,
	gitIn,
	hookMode,
	hookRepository,
	hookText,
	quality,
	qualityFrom,
	withOwnHook,
	withQualityAt,
	withWorktree,
} from "#test/hookRepository.ts";
import { removeSeededTrees } from "#test/tree.ts";

const CLI_TIMEOUT = 60_000;
const OWNER = "# Installed by @shivaedev/quality: `quality hooks install` writes it, `quality hooks uninstall` removes it.";

afterEach(removeSeededTrees);

function hookAt(root: string): string {
	return join(realpathSync(root), ".git", "hooks", "pre-commit");
}

describe("quality hooks install", { timeout: CLI_TIMEOUT }, () => {
	it("installs an executable pre-commit hook that runs the checked-out worktree's quality", () => {
		const repository = hookRepository();

		expect(quality(repository.root, "hooks", "install")).toEqual({
			status: 0,
			stderr: "",
			stdout: `quality: installed the pre-commit hook at ${hookAt(repository.root)}; each commit runs \`node_modules/.bin/quality hooks pre-commit\`.\n`,
		});
		expect(hookText(repository)).toBe(
			[
				"#!/bin/sh",
				OWNER,
				'top="$(git rev-parse --show-toplevel)" || exit 2',
				'if [ -n "$GIT_DIR" ] && [ -z "$GIT_WORK_TREE" ]; then export GIT_WORK_TREE="$top"; fi',
				'cd "$top" || exit 2',
				"quality=node_modules/.bin/quality",
				'if [ ! -e "$quality" ]; then',
				'\tprintf \'quality: cannot check this commit: %s/%s does not exist.\\nhelp: install the dependencies of this worktree, then commit again.\\n\' "$PWD" "$quality" >&2',
				"\texit 2",
				"fi",
				'exec "$quality" hooks pre-commit',
				"",
			].join("\n"),
		);
		expect(hookMode(repository)).toBe(0o755);
		expect(gitIn(repository.root, "config", "--local", "--list")).not.toContain("hookspath");
	});

	it("installs again over its own hook and says it is up to date", () => {
		const repository = hookRepository();
		quality(repository.root, "hooks", "install");

		expect(quality(repository.root, "hooks", "install").stdout).toBe(`quality: the pre-commit hook at ${hookAt(repository.root)} is up to date.\n`);
	});

	it("keeps a pre-commit hook that is not quality's and says how to check commits with it", () => {
		const repository = withOwnHook(hookRepository(), "#!/bin/sh\nmake check\n");

		const result = quality(repository.root, "hooks", "install");

		expect(result.status).toBe(0);
		expect(result.stderr).toBe(
			`quality: kept ${hookAt(repository.root)}: it is not quality's pre-commit hook, so quality does not check commits.\nhelp: call \`node_modules/.bin/quality hooks pre-commit\` from that hook, or replace it with \`quality hooks install --force\`.\n`,
		);
		expect(hookText(repository)).toBe("#!/bin/sh\nmake check\n");
	});

	it("replaces a pre-commit hook that is not quality's with --force", () => {
		const repository = withOwnHook(hookRepository(), "#!/bin/sh\nmake check\n");

		expect(quality(repository.root, "hooks", "install", "--force").stdout).toContain(
			`quality: replaced ${hookAt(repository.root)}, which was not quality's hook;`,
		);
		expect(hookText(repository)).toContain(OWNER);
	});

	it("installs from a linked worktree into the hooks every worktree shares", () => {
		const repository = hookRepository();
		const worktree = withWorktree(repository, "feature");

		expect(quality(worktree, "hooks", "install").status).toBe(0);
		expect(hookText(repository)).toContain(OWNER);
		expect(quality(repository.root, "hooks", "install").stdout).toContain("is up to date");
	});

	it("notes a core.hooksPath that git runs instead of the installed hook", () => {
		const repository = hookRepository();
		gitIn(repository.root, "config", "core.hooksPath", ".husky/_");

		expect(quality(repository.root, "hooks", "install").stderr).toBe(
			`note: core.hooksPath is .husky/_, so git runs the pre-commit hook there; ${hookAt(repository.root)} runs only when that hook calls it.\n`,
		);
	});

	it("runs quality the way install ran it when that is a file in the repository, with the same Node options", () => {
		const repository = hookRepository();
		const local = withQualityAt(repository, "tools/quality.ts");

		qualityFrom(local, repository.root, "hooks", "install");

		expect(hookText(repository)).toContain("quality=tools/quality.ts\n");
		expect(hookText(repository)).toContain('exec node --conditions=source "$quality" hooks pre-commit\n');
		expect(commits(repository.root, "Checked by the repository's own quality").status).toBe(0);
	});

	it("runs from the folder of a config below the repository root", () => {
		const repository = hookRepository({ folder: "app", preCommit: '{ run: ["test -f quality.config.ts"] }' });

		quality(join(repository.root, "app"), "hooks", "install");

		expect(hookText(repository)).toContain('cd "$top"/app || exit 2\n');
		expect(commits(repository.root, "Checked from app").status).toBe(0);
	});
});

describe("quality hooks uninstall", { timeout: CLI_TIMEOUT }, () => {
	it("removes quality's hook", () => {
		const repository = hookRepository();
		quality(repository.root, "hooks", "install");

		expect(quality(repository.root, "hooks", "uninstall").stdout).toBe(`quality: removed the pre-commit hook at ${hookAt(repository.root)}.\n`);
		expect(hookText(repository)).toBeUndefined();
	});

	it("keeps a hook that is not quality's", () => {
		const repository = withOwnHook(hookRepository(), "#!/bin/sh\nmake check\n");

		expect(quality(repository.root, "hooks", "uninstall").stderr).toBe(
			`quality: kept ${hookAt(repository.root)}: it is not quality's pre-commit hook.\n`,
		);
		expect(hookText(repository)).toBe("#!/bin/sh\nmake check\n");
	});
});
