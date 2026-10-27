import { requireThat } from "#error.ts";
import type { Release, ReleasePlan } from "#model.ts";
import { parseChangeset } from "#parser.ts";
import { renderEntries } from "#sections.ts";

export function collectChangelog(previous: string, release: Release, plan: ReleasePlan, date: string): string {
	const timestamp = Date.parse(`${date}T00:00:00Z`);
	requireThat(
		/^\d{4}-\d{2}-\d{2}$/u.test(date) && Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date,
		"Use a valid UTC YYYY-MM-DD release date in every new changelog heading; rerun releases apply.",
	);
	requireThat(
		previous.startsWith("# Changelog\n") && !/^## Unreleased\s*$/mu.test(previous),
		`${release.name}: use a '# Changelog' title and move Unreleased notes into .changeset/*.md.`,
	);
	requireThat(
		!new RegExp(`^## ${release.to.replaceAll(".", "\\.")}(?: - |$)`, "mu").test(previous),
		`${release.name}: version ${release.to} already has notes; restore the package version and rerun releases apply.`,
	);
	const entries = plan.changesets.flatMap((source) => {
		const changeset = parseChangeset(source);
		return Object.hasOwn(changeset.packages, release.name) ? changeset.entries : [];
	});
	const dependencyNotes = entries.length === 0 ? [{ section: "Changed" as const, text: "- Release with updated workspace dependencies." }] : [];
	const history = previous.slice("# Changelog\n".length).trimStart();
	return `# Changelog\n\n## ${release.to} - ${date}\n\n${renderEntries([...entries, ...dependencyNotes])}${history === "" ? "" : `\n${history}`}`;
}
