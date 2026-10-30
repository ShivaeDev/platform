import { Effect } from "effect";
import type { ReleasePlan } from "#model.ts";
import { parseChangeset } from "#parser.ts";
import { renderEntries } from "#sections.ts";

export const collectMigrationNotes = Effect.fn("Changesets.collectMigrationNotes")(function* (plan: ReleasePlan) {
	const changesets = yield* Effect.forEach(plan.changesets, parseChangeset);
	const breaking = plan.releases.flatMap((release) => {
		const entries = changesets.flatMap((changeset) =>
			Object.hasOwn(changeset.packages, release.name) ? changeset.entries.filter((entry) => entry.section === "Breaking") : [],
		);
		return entries.length === 0 ? [] : [`### ${release.name}\n\n${entries.map((entry) => entry.text).join("\n")}`];
	});
	const rules = changesets.flatMap((changeset) => changeset.entries.filter((entry) => entry.section === "Quality rules"));
	if (breaking.length === 0 && rules.length === 0) {
		return "No breaking changes or new or stricter quality rules in this release.";
	}
	return [
		"## Migration checklist",
		...breaking,
		...(rules.length === 0 ? [] : [`### Quality rules\n\n${rules.map((entry) => entry.text).join("\n")}`]),
	].join("\n\n");
});

export const collectReleaseNotes = Effect.fn("Changesets.collectReleaseNotes")(function* (plan: ReleasePlan) {
	const migrations = yield* collectMigrationNotes(plan);
	const changesets = yield* Effect.forEach(plan.changesets, parseChangeset);
	const packages = plan.releases.map((release) => {
		const entries = changesets.flatMap((changeset) => (Object.hasOwn(changeset.packages, release.name) ? changeset.entries : []));
		const notes = entries.length === 0 ? "### Changed\n\n- Release with updated workspace dependencies.\n" : renderEntries(entries);
		return `## ${release.name} ${release.to}\n\n${notes}`;
	});
	return `${[migrations, ...packages].join("\n\n")}\n`;
});
