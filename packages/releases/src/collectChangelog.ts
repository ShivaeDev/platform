import { Effect } from "effect";
import { ChangesetError } from "#error.ts";
import type { Release, ReleasePlan } from "#model.ts";
import { parseChangeset } from "#parser.ts";
import { renderEntries } from "#sections.ts";

export const collectChangelog = Effect.fn("Changesets.collectChangelog")(function* (
	previous: string,
	release: Release,
	plan: ReleasePlan,
	date: string,
) {
	const timestamp = Date.parse(`${date}T00:00:00Z`);
	if (!(/^\d{4}-\d{2}-\d{2}$/u.test(date) && Number.isFinite(timestamp)) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
		return yield* new ChangesetError({ message: "Use a valid UTC YYYY-MM-DD release date in every new changelog heading; rerun releases apply." });
	}
	if (!previous.startsWith("# Changelog\n") || /^## Unreleased\s*$/mu.test(previous)) {
		return yield* new ChangesetError({ message: `${release.name}: use a '# Changelog' title and move Unreleased notes into .changeset/*.md.` });
	}
	if (new RegExp(`^## ${release.to.replaceAll(".", "\\.")}(?: - |$)`, "mu").test(previous)) {
		return yield* new ChangesetError({
			message: `${release.name}: version ${release.to} already has notes; restore the package version and rerun releases apply.`,
		});
	}
	const changesets = yield* Effect.forEach(plan.changesets, parseChangeset);
	const entries = changesets.flatMap((changeset) => (Object.hasOwn(changeset.packages, release.name) ? changeset.entries : []));
	const dependencyNotes = entries.length === 0 ? [{ section: "Changed" as const, text: "- Release with updated workspace dependencies." }] : [];
	const history = previous.slice("# Changelog\n".length).trimStart();
	return `# Changelog\n\n## ${release.to} - ${date}\n\n${renderEntries([...entries, ...dependencyNotes])}${history === "" ? "" : `\n${history}`}`;
});
