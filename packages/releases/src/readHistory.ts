import { posix } from "node:path";
import { Effect } from "effect";
import type { ChangesetConfig } from "#config.ts";
import { git } from "#git.ts";
import { historyBase } from "#historyBase.ts";
import type { Workspace } from "#model.ts";
import { decodePackage, isChangeset, packagePatterns } from "#workspace.ts";

export const readHistory = Effect.fn("Changesets.readHistory")(function* (root: string, config: ChangesetConfig, reference?: string) {
	const base = yield* historyBase(root, reference);
	const paths = (yield* git(root, ["ls-tree", "-r", "--name-only", base])).trim().split("\n");
	const packages = yield* Effect.forEach(
		paths.filter(
			(path) => posix.basename(path) === "package.json" && packagePatterns(config).some((pattern) => posix.matchesGlob(posix.dirname(path), pattern)),
		),
		Effect.fn("Changesets.historyPackage")(function* (path) {
			const directory = posix.dirname(path);
			const text = yield* git(root, ["show", `${base}:${path}`]);
			const changelogPath = posix.join(directory, "CHANGELOG.md");
			const changelog = paths.includes(changelogPath) ? yield* git(root, ["show", `${base}:${changelogPath}`]) : "# Changelog\n";
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
