import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sortPackageJson from "sort-package-json";
import type { Run } from "./cli.ts";
import { commitAll, git, ISOLATED_ENV } from "./git.ts";
import { formatTree } from "./qualityTree.ts";
import { DEFAULT_FILES, linkPackage, packageRoot, type SeedFile, seedTree } from "./tree.ts";

export interface HookRepository {
	readonly folder: string;
	readonly hook: string;
	readonly root: string;
}

export interface HookSetup {
	readonly configless?: boolean;
	readonly files?: readonly SeedFile[];
	readonly folder?: string;
	readonly scripts?: Readonly<Record<string, string>>;
}

const CHECKS_LOG = "checks.log";

const SOURCE_EXPORTS = {
	"./*.ts": Object.fromEntries([
		["source", "./src/*.ts"],
		["types", "./dist/*.d.ts"],
		["default", "./dist/*.js"],
	]),
};

// Pre-commit scripts write to the hook's own output streams, so a run in this process reads what they did from a log.
export function logs(line: string): string {
	return `echo ${line} >> ${CHECKS_LOG}`;
}

export function checksLog(root: string): string {
	return existsSync(join(root, CHECKS_LOG)) ? readFileSync(join(root, CHECKS_LOG), "utf8") : "";
}

const CLEAN: SeedFile = { content: "export function full(): number {\n\treturn 1;\n}\n", path: "src/full.ts" };

const BIN = `#!/bin/sh\nexec node --conditions=source ${join(packageRoot, "src", "cli.ts")} "$@"\n`;

const CONFIG: SeedFile = {
	content: 'export default { rules: { "structure/max-lines": { options: { source: 3 } } }, sources: ["src"] };\n',
	path: "quality.config.ts",
};

export function writes(root: string, path: string, content: string): void {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), content);
}

function manifest(fields: Readonly<Record<string, unknown>>): string {
	return `${JSON.stringify(sortPackageJson({ exports: SOURCE_EXPORTS, type: "module", ...fields }), null, "\t")}\n`;
}

function withBin(root: string): void {
	writes(root, "node_modules/.bin/quality", BIN);
	chmodSync(join(root, "node_modules/.bin/quality"), 0o755);
}

// A committed repository whose installed quality is this package's source, behind the bin a package manager links.
export function hookRepository({
	configless = false,
	files = configless ? DEFAULT_FILES : [CLEAN],
	folder = "",
	scripts = {},
}: HookSetup = {}): HookRepository {
	const root = seedTree(
		[
			...(configless
				? []
				: [
						CONFIG,
						{ content: "node_modules/\n", path: ".gitignore" },
						{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
					]),
			{ content: "loglevel=silent\n", path: ".npmrc" },
			{ content: manifest({ scripts }), path: "package.json" },
			...files,
		].map((file) => ({
			...file,
			path: join(folder, file.path),
		})),
		[{ content: "node_modules/\n", path: ".gitignore" }],
	);
	withBin(join(root, folder));
	linkPackage(join(root, folder));
	formatTree(join(root, folder));
	git(root, "init", "--quiet");
	commitAll(root, "Base");
	return { folder, hook: join(root, ".git", "hooks", "pre-commit"), root };
}

export function withScripts(root: string, scripts: Readonly<Record<string, string>>, packageManager?: string): string {
	writes(root, "package.json", manifest({ packageManager, scripts }));
	return root;
}

export function withQualityAt(repository: HookRepository, path: string): string {
	writes(repository.root, path, 'import "@shivaedev/quality/cli.ts";\n');
	writes(repository.root, "package.json", manifest({ bin: { quality: `./${path}` }, devDependencies: { "@shivaedev/quality": "*" } }));
	formatTree(repository.root);
	return join(repository.root, path);
}

export function withBareWorktree(repository: HookRepository, name: string, root = seedTree([])): string {
	git(repository.root, "worktree", "add", "--quiet", "-b", name, root);
	return root;
}

export function withWorktree(repository: HookRepository, name: string, at?: string): string {
	const root = withBareWorktree(repository, name, at);
	withBin(join(root, repository.folder));
	linkPackage(join(root, repository.folder));
	return root;
}

export function commits(cwd: string, message: string): Run {
	const result = spawnSync("git", ["commit", "--quiet", "--allow-empty", "--message", message], { cwd, encoding: "utf8", env: ISOLATED_ENV });
	return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

export function hookText(repository: HookRepository): string | undefined {
	return existsSync(repository.hook) ? readFileSync(repository.hook, "utf8") : undefined;
}

export function hookMode(repository: HookRepository): number {
	return statSync(repository.hook).mode & 0o777;
}
