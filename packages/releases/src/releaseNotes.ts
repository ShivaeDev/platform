import { Effect } from "effect";
import { collectPackageNotes } from "#collectPackageNotes.ts";
import type { ReleasePlan } from "#model.ts";
import { parseChangeset } from "#parser.ts";
import { renderEntries } from "#sections.ts";

export const collectMigrationNotes = Effect.fn("Changesets.collectMigrationNotes")(function* (plan: ReleasePlan) {
	const changesets = yield* Effect.forEach(plan.changesets, parseChangeset);
	const breaking = plan.releases.flatMap((release) => {
		const entries = changesets.flatMap((changeset) =>
			changeset.entries.filter((entry) => entry.package === release.name && entry.section === "Breaking"),
		);
		return entries.length === 0 ? [] : [`### ${release.name}\n\n${renderEntries(entries, false)}`];
	});
	const rules = changesets.flatMap((changeset) => changeset.entries.filter((entry) => entry.section === "Quality rules"));
	if (breaking.length === 0 && rules.length === 0) {
		return "No breaking changes or new or stricter quality rules in this release.";
	}
	return ["## Migration checklist", ...breaking, ...(rules.length === 0 ? [] : [renderEntries(rules).trimEnd()])].join("\n\n");
});

export const collectReleaseNotes = Effect.fn("Changesets.collectReleaseNotes")(function* (plan: ReleasePlan) {
	const migrations = yield* collectMigrationNotes(plan);
	const packages = yield* Effect.forEach(plan.releases, (release) =>
		Effect.gen(function* () {
			const notes = yield* collectPackageNotes(release, plan);
			return `## ${release.name} ${release.to}\n\n${notes}`;
		}),
	);
	return `${[migrations, ...packages].join("\n\n")}\n`;
});
