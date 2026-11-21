import { Effect } from "effect";
import type { Release, ReleasePlan } from "#model.ts";
import { parseChangeset } from "#parser.ts";
import { renderEntries } from "#sections.ts";

export const collectPackageNotes = Effect.fn("Changesets.collectPackageNotes")(function* (
	release: Release,
	plan: ReleasePlan,
	dependencies: readonly string[] = [],
) {
	const changesets = yield* Effect.forEach(plan.changesets, (source) => Effect.fromResult(parseChangeset(source)));
	const entries = changesets.flatMap((changeset) => changeset.entries.filter((entry) => entry.package === release.name));
	const moved = plan.releases.filter((candidate) => dependencies.includes(candidate.name));
	const dependencyNotes =
		moved.length === 0
			? [{ section: "Changed" as const, text: "- Release with updated workspace dependencies." }]
			: moved.map((dependency) => ({
					section: "Changed" as const,
					text: `- Update \`${dependency.name}\` from ${dependency.from} to ${dependency.to}.`,
				}));
	const forwarded = changesets.flatMap((changeset) =>
		changeset.entries
			.filter((entry) => entry.section === "Breaking" && release.breakingDependencies?.includes(entry.package) === true)
			.map((entry) => ({ section: "Breaking" as const, text: `- \`${entry.package}\`: ${entry.text.slice(2)}` })),
	);
	return renderEntries([...(entries.length === 0 ? dependencyNotes : entries), ...forwarded]);
});
