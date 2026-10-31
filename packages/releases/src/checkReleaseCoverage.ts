import { Effect } from "effect";
import { ChangesetError } from "#error.ts";
import { git } from "#git.ts";
import type { ReleasePlan, Source } from "#model.ts";

export const checkReleaseCoverage = Effect.fn("Changesets.checkReleaseCoverage")(function* (
	root: string,
	plan: ReleasePlan,
	pending: readonly Source[],
) {
	if (plan.releases.length === 0 || pending.length === 0) {
		return;
	}
	const commits = (yield* git(root, [
		"log",
		"--format=%h %s",
		"--diff-filter=A",
		"HEAD",
		"--",
		...pending.map((source) => `.changeset/${source.name}`),
	])).trim();
	return yield* new ChangesetError({
		message: `Release leaves pending changesets outside its notes: ${pending.map((source) => source.name).join(", ")}.${commits === "" ? "" : `\nCommits:\n${commits}`}\nLet the release PR regenerate before merging or publishing.`,
	});
});
