import { Effect } from "effect";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import type { ReleasePlan } from "@shivaedev/releases/model.ts";
import { parseChangeset } from "@shivaedev/releases/parser.ts";
import { collectMigrationNotes } from "@shivaedev/releases/releaseNotes.ts";

export const releasePrSummary = Effect.fn("Release.releasePrSummary")(function* (plan: ReleasePlan) {
	const first = plan.releases[0];
	if (first === undefined) {
		return yield* new ChangesetError({ message: "A release PR needs a pending release." });
	}
	const title = `Release ${first.name} ${first.to}${plan.releases.length > 1 ? ` and ${plan.releases.length - 1} more packages` : ""}`;
	const migrations = yield* collectMigrationNotes(plan);
	const packages = plan.releases.map((release) => `| ${release.name} | ${release.from} | ${release.to} | ${release.bump} |`).join("\n");
	const entries = (yield* Effect.forEach(
		plan.changesets,
		Effect.fn("Release.changesetSummary")(function* (source) {
			const changeset = yield* parseChangeset(source);
			return `#### ${source.name}\n\nPackages: ${Object.keys(changeset.packages).join(", ")}\n\n${changeset.entries.map((entry) => `**${entry.section}**\n\n${entry.text}`).join("\n\n")}`;
		}),
	)).join("\n\n");
	return {
		body: `${migrations}\n\n### Why?\n\nThis PR holds the current release plan: press **Approve and run**, then merge when full CI is green.\n\n### How?\n\nThis branch is regenerated from main with the releases plan applied. Merging it publishes through the existing main-only npm trusted publishing workflow.\n\n| Package | Current | Release | Bump |\n| --- | --- | --- | --- |\n${packages}\n\n#### Changes\n\n${entries}\n\n### Decisions\n\n- Enable **Allow GitHub Actions to create pull requests** under Settings → Actions → General → Workflow permissions. Only GITHUB_TOKEN is used.\n- While this PR is in the merge queue, the automation leaves it untouched so a force-push cannot eject it.\n`,
		title,
	};
});
