import type { ReleasePlan } from "@shivaedev/changesets/model.ts";
import { parseChangeset } from "@shivaedev/changesets/parser.ts";

export function releasePrSummary(plan: ReleasePlan) {
	const first = plan.releases[0];
	if (first === undefined) {
		throw new Error("A release PR needs a pending release.");
	}
	const title = `Release ${first.name} ${first.to}${plan.releases.length > 1 ? ` and ${plan.releases.length - 1} more packages` : ""}`;
	const packages = plan.releases.map((release) => `| ${release.name} | ${release.from} | ${release.to} | ${release.bump} |`).join("\n");
	const entries = plan.changesets
		.map((source) => {
			const changeset = parseChangeset(source);
			return `#### ${source.name}\n\nPackages: ${Object.keys(changeset.packages).join(", ")}\n\n${changeset.entries.map((entry) => `**${entry.section}**\n\n${entry.text}`).join("\n\n")}`;
		})
		.join("\n\n");
	return {
		body: `### Why?\n\nMerge this PR whenever you want a release of the pending changes.\n\n### How?\n\nThis branch is regenerated from main with the changesets plan applied. Merging it publishes through the existing main-only npm trusted publishing workflow.\n\n| Package | Current | Release | Bump |\n| --- | --- | --- | --- |\n${packages}\n\n#### Changes\n\n${entries}\n\n### Decisions\n\n- Enable **Allow GitHub Actions to create pull requests** under Settings → Actions → General → Workflow permissions. Only GITHUB_TOKEN is used.\n- While this PR is in the merge queue, the automation leaves it untouched so a force-push cannot eject it.\n`,
		title,
	};
}
