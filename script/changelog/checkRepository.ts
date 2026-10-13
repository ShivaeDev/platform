import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { Effect, FileSystem } from "effect";
import { assertPackageChange } from "./assertPackageChange.ts";
import { attempt } from "./attempt.ts";
import { decodeVersion, type PackageNotes, readPackage } from "./package.ts";
import { decodeReleaseManifest } from "./releaseManifest.ts";

function git(root: string, args: readonly string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function resolveReference(root: string, reference: string | undefined): string {
	const candidates = reference === undefined ? ["origin/main", "main"] : [reference];
	const found = candidates.find(
		(candidate) => spawnSync("git", ["-C", root, "rev-parse", "--verify", "--quiet", `${candidate}^{commit}`]).status === 0,
	);
	if (found === undefined) {
		throw new Error(`Changelog base ${candidates.join(" or ")} not found; fetch it with git fetch origin main.`);
	}
	return found;
}

function mergeBase(root: string, reference: string, merging: readonly string[]): string {
	const result = spawnSync("git", ["-C", root, "merge-base", reference, "HEAD", ...merging], { encoding: "utf8" });
	if (result.status !== 0) {
		throw new Error(`No merge base between ${reference} and HEAD; fetch the full history with git fetch --unshallow origin main.`);
	}
	return result.stdout.trim();
}

function basePackage(root: string, base: string, name: string, paths: readonly string[]): PackageNotes | undefined {
	const directory = `packages/${name}`;
	if (!paths.includes(`${directory}/package.json`)) {
		return undefined;
	}
	function read(path: string) {
		return git(root, ["show", `${base}:${path}`]);
	}
	return {
		changelog: paths.includes(`${directory}/CHANGELOG.md`) ? read(`${directory}/CHANGELOG.md`) : "# Changelog\n",
		fragments: paths
			.filter((path) => path.startsWith(`${directory}/changes/`) && path.endsWith(".md"))
			.map((path) => ({ name: path.slice(`${directory}/changes/`.length), text: read(path) })),
		release: paths.includes(`${directory}/release.json`) ? decodeReleaseManifest(read(`${directory}/release.json`)) : undefined,
		version: decodeVersion(read(`${directory}/package.json`)),
	};
}

export const checkRepository = Effect.fn("Changelog.checkRepository")(function* (root: string, reference?: string) {
	const fs = yield* FileSystem.FileSystem;
	const mergePath = yield* attempt(() => resolve(root, git(root, ["rev-parse", "--git-path", "MERGE_HEAD"]).trim()));
	const merging = (yield* fs.exists(mergePath)) ? (yield* fs.readFileString(mergePath)).trim().split("\n") : [];
	const base = yield* attempt(() => mergeBase(root, resolveReference(root, reference), merging));
	const paths = yield* attempt(() => git(root, ["ls-tree", "-r", "--name-only", base, "packages"]).trim().split("\n"));
	const names = yield* fs.readDirectory(join(root, "packages"));
	yield* Effect.forEach(names, (name) =>
		Effect.gen(function* () {
			const directory = join(root, "packages", name);
			if (!(yield* fs.exists(join(directory, "package.json")))) {
				return;
			}
			const before = yield* attempt(() => basePackage(root, base, name, paths));
			const after = yield* readPackage(directory);
			yield* attempt(() => assertPackageChange(name, before, after));
		}),
	);
});
