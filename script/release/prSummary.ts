import { Effect } from "effect";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import type { ReleasePlan } from "@shivaedev/releases/model.ts";

export const releasePrSummary = Effect.fn("Release.releasePrSummary")(function* (plan: ReleasePlan) {
	const first = plan.releases[0];
	if (first === undefined) {
		return yield* new ChangesetError({ message: "A release PR needs a pending release." });
	}
	const title = `Release ${first.name} ${first.to}${plan.releases.length > 1 ? ` and ${plan.releases.length - 1} more packages` : ""}`;
	const packages = plan.releases.map((release) => `| ${release.name} | ${release.from} | ${release.to} | ${release.bump} |`).join("\n");
	return {
		body: `### Why?\n\nThis PR holds the current release plan: press **Approve and run**, then merge when full CI is green.\n\n### How?\n\nThis branch is regenerated from main with the releases plan applied. Merging it builds and publishes this frozen branch commit through the main-only npm trusted publishing workflow. Changes merged to main during the freeze ship in the next release. Release notes and tags target this branch head; npm provenance records the pushed main commit that runs the workflow, with GitHub’s OIDC environment unchanged.\n\n| Package | Current | Release | Bump |\n| --- | --- | --- | --- |\n${packages}\n\nMigration steps and change notes are in each package's \`CHANGELOG.md\` in this diff and lead the GitHub release.\n\n### Decisions\n\n- Enable **Allow GitHub Actions to create pull requests** under Settings → Actions → General → Workflow permissions. Only GITHUB_TOKEN is used.\n- The description leaves out migration steps and change notes because the squash commit message is built from it and GitHub caps that at 16,383 characters.\n- While this PR is in the merge queue, the automation leaves it untouched so a force-push cannot eject it.\n`,
		title,
	};
});
