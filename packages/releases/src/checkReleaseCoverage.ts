import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import { ChangesetError } from "#error.ts";
import { git } from "#git.ts";
import { historyBase } from "#historyBase.ts";
import type { ReleasePlan, Source } from "#model.ts";

const uncoveredChangesets = Effect.fn("Changesets.uncoveredChangesets")(function* (root: string, pending: readonly Source[], reference?: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = join(root, ".changeset/release-base");
	if (!(yield* fs.exists(path))) {
		return pending;
	}
	const base = (yield* fs.readFileString(path)).trim();
	const current = yield* historyBase(root, reference);
	if ((yield* git(root, ["merge-base", base, current])).trim() !== base) {
		return yield* new ChangesetError({ message: "The recorded release base must be an ancestor of the checked main revision." });
	}
	const original = (yield* git(root, ["ls-tree", "-r", "--name-only", base, "--", ".changeset"])).trim().split("\n");
	const main = (yield* git(root, ["ls-tree", "-r", "--name-only", current, "--", ".changeset"])).trim().split("\n");
	return yield* Effect.filter(
		pending,
		Effect.fn("Changesets.uncoveredChangeset")(function* (source) {
			const file = `.changeset/${source.name}`;
			return original.includes(file) || !main.includes(file) || (yield* git(root, ["show", `${current}:${file}`])) !== source.text;
		}),
	);
});

export const checkReleaseCoverage = Effect.fn("Changesets.checkReleaseCoverage")(function* (
	root: string,
	plan: ReleasePlan,
	pending: readonly Source[],
	reference?: string,
) {
	if (plan.releases.length === 0 || pending.length === 0) {
		return;
	}
	const uncovered = yield* uncoveredChangesets(root, pending, reference);
	if (uncovered.length === 0) {
		return;
	}
	const commits = (yield* git(root, [
		"log",
		"--format=%h %s",
		"--diff-filter=A",
		"HEAD",
		"--",
		...uncovered.map((source) => `.changeset/${source.name}`),
	])).trim();
	return yield* new ChangesetError({
		message: `Release leaves pending changesets outside its notes: ${uncovered.map((source) => source.name).join(", ")}.${commits === "" ? "" : `\nCommits:\n${commits}`}\nLet the release PR regenerate before merging or publishing.`,
	});
});
