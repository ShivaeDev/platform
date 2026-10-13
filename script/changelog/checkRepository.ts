import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { Effect, FileSystem } from "effect";
import { assertPackageChange } from "./assertPackageChange.ts";
import { attempt } from "./attempt.ts";
import { readPackage } from "./package.ts";
import { readCommittedNotes, releaseNotes } from "./releaseNotes.ts";

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

export const checkRepository = Effect.fn("Changelog.checkRepository")(function* (root: string, reference?: string) {
	const fs = yield* FileSystem.FileSystem;
	const mergePath = yield* attempt(() => resolve(root, git(root, ["rev-parse", "--git-path", "MERGE_HEAD"]).trim()));
	const merging = (yield* fs.exists(mergePath)) ? (yield* fs.readFileString(mergePath)).trim().split("\n") : [];
	const base = yield* attempt(() => mergeBase(root, resolveReference(root, reference), merging));
	const names = yield* fs.readDirectory(join(root, "packages"));
	yield* Effect.forEach(names, (name) =>
		Effect.gen(function* () {
			const directory = join(root, "packages", name);
			if (!(yield* fs.exists(join(directory, "package.json")))) {
				return;
			}
			const before = yield* attempt(() => readCommittedNotes(root, base, name));
			const after = yield* readPackage(directory);
			yield* attempt(() => assertPackageChange(name, before === undefined ? undefined : releaseNotes(root, base, name, before, after), after));
		}),
	);
});
