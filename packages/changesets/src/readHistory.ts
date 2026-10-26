import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { Effect } from "effect";
import type { ChangesetConfig } from "#config.ts";
import { attempt, ChangesetError } from "#error.ts";
import type { Workspace } from "#model.ts";
import { decodePackage, isChangeset, packagePatterns } from "#workspace.ts";

function git(root: string, args: readonly string[]): string {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
export const readHistory = Effect.fn("Changesets.readHistory")(function* (root: string, config: ChangesetConfig, reference?: string) {
	const base = yield* attempt(() => {
		const mergeHead = git(root, ["rev-parse", "--path-format=absolute", "--git-path", "MERGE_HEAD"]).trim();
		const heads = ["HEAD", ...(existsSync(mergeHead) ? readFileSync(mergeHead, "utf8").trim().split("\n") : [])];
		for (const candidate of reference === undefined ? ["origin/main", "main"] : [reference]) {
			const result = spawnSync("git", ["-C", root, "merge-base", candidate, ...heads], { encoding: "utf8" });
			if (result.status === 0) {
				return result.stdout.trim();
			}
		}
		throw new ChangesetError({
			message: `Cannot resolve changeset base ${reference ?? "origin/main or main"}; run git fetch origin main or pass an existing base-ref with full history.`,
		});
	});
	return yield* attempt((): Workspace => {
		const paths = git(root, ["ls-tree", "-r", "--name-only", base]).trim().split("\n");
		function read(path: string, fallback: string) {
			return paths.includes(path) ? git(root, ["show", `${base}:${path}`]) : fallback;
		}
		const packages = paths
			.filter((path) => path.endsWith("/package.json") && packagePatterns(config).some((pattern) => posix.matchesGlob(posix.dirname(path), pattern)))
			.map((path) => decodePackage(posix.dirname(path), read(path, ""), read(`${posix.dirname(path)}/CHANGELOG.md`, "# Changelog\n")));
		const changesets = paths
			.filter((path) => path.startsWith(".changeset/") && isChangeset(path.slice(".changeset/".length)))
			.map((path) => ({ name: path.slice(".changeset/".length), text: read(path, "") }));
		return { changesets, packages };
	});
});
