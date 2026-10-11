import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { Effect, FileSystem } from "effect";
import { assertPackageChange } from "./assertPackageChange.ts";
import { attempt } from "./attempt.ts";
import { decodeVersion, type PackageNotes, readPackage } from "./package.ts";

function git(root: string, args: readonly string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });
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
			.map((path) => ({
				name: path.slice(`${directory}/changes/`.length),
				text: read(path),
			})),
		version: decodeVersion(read(`${directory}/package.json`)),
	};
}

export const checkRepository = Effect.fn("Changelog.checkRepository")(function* (root: string, reference = "origin/main") {
	const fs = yield* FileSystem.FileSystem;
	const mergePath = yield* attempt(() => resolve(root, git(root, ["rev-parse", "--git-path", "MERGE_HEAD"]).trim()));
	const merging = (yield* fs.exists(mergePath)) ? (yield* fs.readFileString(mergePath)).trim().split("\n") : [];
	const base = yield* attempt(() => git(root, ["merge-base", reference, "HEAD", ...merging]).trim());
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
