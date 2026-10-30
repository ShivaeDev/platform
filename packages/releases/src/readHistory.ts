import { posix } from "node:path";
import { Effect, FileSystem } from "effect";
import type { ChangesetConfig } from "#config.ts";
import { ChangesetError, GitError } from "#error.ts";
import { git } from "#git.ts";
import type { Workspace } from "#model.ts";
import { runCommand } from "#runCommand.ts";
import { decodePackage, isChangeset, packagePatterns } from "#workspace.ts";

const mergeBase = Effect.fn("Changesets.mergeBase")(function* (root: string, reference?: string) {
	const fs = yield* FileSystem.FileSystem;
	const mergeHead = (yield* git(root, ["rev-parse", "--path-format=absolute", "--git-path", "MERGE_HEAD"])).trim();
	const heads = ["HEAD", ...((yield* fs.exists(mergeHead)) ? (yield* fs.readFileString(mergeHead)).trim().split("\n") : [])];
	let cause: unknown;
	let target = reference ?? "origin/main or main";
	for (const candidate of reference === undefined ? ["origin/main", "main"] : [reference]) {
		const resolved = yield* runCommand(root, "git", ["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`]);
		if (resolved.exitCode === 1) {
			cause = resolved;
			continue;
		}
		if (resolved.exitCode !== 0) {
			return yield* new GitError({ cause: resolved, message: resolved.stderr.trim() });
		}
		const result = yield* runCommand(root, "git", ["merge-base", resolved.stdout.trim(), ...heads]);
		if (result.exitCode === 0) {
			return result.stdout.trim();
		}
		if (result.exitCode !== 1) {
			return yield* new GitError({ cause: result, message: result.stderr.trim() });
		}
		cause = result;
		target = candidate;
		break;
	}
	return yield* new ChangesetError({
		cause,
		message: `Cannot resolve changeset base ${target}; run git fetch origin main or pass an existing base-ref with full history.`,
	});
});

export const readHistory = Effect.fn("Changesets.readHistory")(function* (root: string, config: ChangesetConfig, reference?: string) {
	const base = yield* mergeBase(root, reference);
	const paths = (yield* git(root, ["ls-tree", "-r", "--name-only", base])).trim().split("\n");
	const packages = yield* Effect.forEach(
		paths.filter(
			(path) => path.endsWith("/package.json") && packagePatterns(config).some((pattern) => posix.matchesGlob(posix.dirname(path), pattern)),
		),
		Effect.fn("Changesets.historyPackage")(function* (path) {
			const directory = posix.dirname(path);
			const text = yield* git(root, ["show", `${base}:${path}`]);
			const changelog = paths.includes(`${directory}/CHANGELOG.md`)
				? yield* git(root, ["show", `${base}:${directory}/CHANGELOG.md`])
				: "# Changelog\n";
			return yield* decodePackage(directory, text, changelog);
		}),
	);
	const changesets = yield* Effect.forEach(
		paths.filter((path) => path.startsWith(".changeset/") && isChangeset(path.slice(".changeset/".length))),
		Effect.fn("Changesets.historyChangeset")(function* (path) {
			return { name: path.slice(".changeset/".length), text: yield* git(root, ["show", `${base}:${path}`]) };
		}),
	);
	return { changesets, packages } satisfies Workspace;
});
