import { chmodSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { Effect, Schema } from "effect";
import { checkoutStory } from "./checkoutStory.ts";
import { builtRepository } from "./checkoutVerbs.ts";
import { runQuality } from "./cli.ts";
import { withBareWorktree, withQualityAt, withScripts, withWorktree, writes } from "./hookRepository.ts";
import { packageRoot, type SeedFile } from "./tree.ts";

function pathsOf(files: readonly SeedFile[]): string {
	return files.map((file) => file.path).join(", ");
}

function writeAll(root: string, files: readonly SeedFile[]): void {
	for (const file of files) {
		writes(root, file.path, file.content);
	}
}

export function withoutConfig() {
	return checkoutStory.trait("repository", "the repository has no quality config, only Quality's Biome preset and src/value.ts", (engine) => {
		engine.layout.configless = true;
	});
}

export function projectIn(folder: string) {
	return checkoutStory.trait("repository", `quality.config.ts and package.json live in ${folder}/, below the repository root`, (engine) => {
		engine.layout.folder = folder;
	});
}

export function packageScripts(scripts: Readonly<Record<string, string>>) {
	const listed = Object.entries(scripts).map(([name, command]) => `${name} runs \`${command}\``);
	return checkoutStory.trait("repository", `package.json declares scripts: ${listed.join("; ")}`, (engine) => {
		engine.layout.scripts = scripts;
	});
}

export function projectHas(...files: readonly SeedFile[]) {
	return checkoutStory.trait("checkout", `the author writes ${pathsOf(files)} without committing`, (engine) => writeAll(engine.root, files));
}

const RootManifest = Schema.fromJsonString(Schema.Struct({ packageManager: Schema.String }));

// The version is this repository's own pnpm, which the tests run under, so pnpm needs no download to honour the field.
export function pnpmDeclared() {
	const { packageManager } = Schema.decodeUnknownSync(RootManifest)(readFileSync(join(packageRoot, "..", "..", "package.json"), "utf8"));
	const [pnpm] = packageManager.split("+");
	return checkoutStory.trait("checkout", `package.json declares ${pnpm} as its packageManager`, (engine) => {
		withScripts(engine.root, engine.layout.scripts, pnpm);
	});
}

export function noPackageManifest() {
	return checkoutStory.trait("checkout", "the project has no package.json", (engine) => rmSync(join(engine.root, "package.json")));
}

export function ownHook(script: string) {
	return checkoutStory.trait("checkout", "the repository already has its own pre-commit hook", (engine) => {
		const { hook } = builtRepository(engine);
		writes(dirname(hook), "pre-commit", script);
		chmodSync(hook, 0o755);
	});
}

export function outsideGit() {
	return checkoutStory.trait("checkout", "the project is not in a git repository", (engine) => {
		rmSync(join(builtRepository(engine).root, ".git"), { force: true, recursive: true });
	});
}

export function qualityFileAt(path: string) {
	return checkoutStory.trait("checkout", `the repository runs quality from its own file ${path}`, (engine) => {
		engine.ownQuality = withQualityAt(builtRepository(engine), path);
	});
}

export interface WorktreeSetup {
	readonly dependencies?: boolean;
	readonly files?: readonly SeedFile[];
	readonly scripts?: Readonly<Record<string, string>>;
}

export function linkedWorktree(name: string, { dependencies = true, files = [], scripts }: WorktreeSetup = {}) {
	const changes = [
		dependencies ? "its dependencies installed" : "no dependencies installed",
		...(files.length === 0 ? [] : [`${pathsOf(files)} written`]),
		...(scripts === undefined ? [] : [`package.json scripts ${JSON.stringify(scripts)}`]),
	];
	return checkoutStory.trait("checkout", `a linked worktree .worktrees/${name} has ${changes.join(", ")}`, (engine) => {
		const repository = builtRepository(engine);
		const at = join(repository.root, ".worktrees", name);
		const folder = join(dependencies ? withWorktree(repository, name, at) : withBareWorktree(repository, name, at), repository.folder);
		writeAll(folder, files);
		if (scripts !== undefined) {
			withScripts(folder, scripts);
		}
		engine.worktrees.set(name, folder);
	});
}

export function hookInstalled() {
	return checkoutStory.trait("hook", "quality hooks install has installed quality's pre-commit hook", function* (engine) {
		const run = yield* Effect.promise(() => runQuality(engine.root, "hooks", "install"));
		if (run.status !== 0) {
			return yield* Effect.die(new Error(`quality hooks install failed: ${run.stderr}`));
		}
	});
}
