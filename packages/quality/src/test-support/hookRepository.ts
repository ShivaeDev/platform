import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { qualityArgs, type Run } from "./cli.ts";
import { commitAll, git, ISOLATED_ENV } from "./git.ts";
import { packageRoot, type SeedFile, seedTree } from "./tree.ts";

export interface HookRepository {
	readonly folder: string;
	readonly hook: string;
	readonly root: string;
}

export interface HookSetup {
	readonly files?: readonly SeedFile[];
	readonly folder?: string;
	readonly preCommit?: string;
}

const CLEAN: SeedFile = { content: "export const a = 1;\nexport const b = 2;\nexport const c = 3;\n", path: "src/full.ts" };

const BIN = `#!/bin/sh\nexec node --conditions=source ${join(packageRoot, "src", "cli.ts")} "$@"\n`;

function run(command: string, args: readonly string[], cwd: string): Run {
	const result = spawnSync(command, [...args], { cwd, encoding: "utf8", env: ISOLATED_ENV });
	return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function preCommitConfig(preCommit: string): SeedFile {
	return {
		content: `export default { rules: { biome: "off", "structure/max-lines": { options: { source: 3 } } }, sources: ["src"], preCommit: ${preCommit} };\n`,
		path: "quality.config.ts",
	};
}

export function writes(root: string, path: string, content: string): void {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), content);
}

function withBin(root: string): void {
	writes(root, "node_modules/.bin/quality", BIN);
	chmodSync(join(root, "node_modules/.bin/quality"), 0o755);
}

// A committed repository whose installed quality is this package's source, behind the bin a package manager links.
export function hookRepository({ files = [CLEAN], folder = "", preCommit = "{}" }: HookSetup = {}): HookRepository {
	const root = seedTree(
		[preCommitConfig(preCommit), ...files].map((file) => ({ ...file, path: join(folder, file.path) })),
		[{ content: "node_modules/\n", path: ".gitignore" }],
	);
	withBin(join(root, folder));
	git(root, "init", "--quiet");
	commitAll(root, "Base");
	return { folder, hook: join(root, ".git", "hooks", "pre-commit"), root };
}

export function withPreCommit(root: string, preCommit: string): string {
	writes(root, "quality.config.ts", preCommitConfig(preCommit).content);
	return root;
}

export function withOwnHook(repository: HookRepository, script: string): HookRepository {
	writes(dirname(repository.hook), "pre-commit", script);
	chmodSync(repository.hook, 0o755);
	return repository;
}

export function withQualityAt(repository: HookRepository, path: string): string {
	mkdirSync(dirname(join(repository.root, path)), { recursive: true });
	symlinkSync(join(packageRoot, "src", "cli.ts"), join(repository.root, path));
	return join(repository.root, path);
}

export function withBareWorktree(repository: HookRepository, name: string): string {
	const root = seedTree([]);
	git(repository.root, "worktree", "add", "--quiet", "-b", name, root);
	return root;
}

export function withWorktree(repository: HookRepository, name: string): string {
	const root = withBareWorktree(repository, name);
	withBin(join(root, repository.folder));
	return root;
}

export function quality(cwd: string, ...args: readonly string[]): Run {
	return run("node", qualityArgs(args), cwd);
}

export function qualityFrom(script: string, cwd: string, ...args: readonly string[]): Run {
	return run("node", ["--conditions=source", script, ...args], cwd);
}

export function commits(cwd: string, message: string): Run {
	return run("git", ["commit", "--quiet", "--allow-empty", "--message", message], cwd);
}

export function stages(cwd: string, ...paths: readonly string[]): Run {
	return run("git", ["add", "--", ...paths], cwd);
}

export function gitIn(cwd: string, ...args: readonly string[]): string {
	return run("git", args, cwd).stdout;
}

export function hookText(repository: HookRepository): string | undefined {
	return existsSync(repository.hook) ? readFileSync(repository.hook, "utf8") : undefined;
}

export function hookMode(repository: HookRepository): number {
	return statSync(repository.hook).mode & 0o777;
}
