import { Effect } from "effect";
import { collectChangelog } from "#collectChangelog.ts";
import { ChangesetError } from "#error.ts";
import type { Release, ReleasePlan, Workspace, WorkspacePackage } from "#model.ts";
import type { Changeset } from "#parser.ts";
import { previousPackage } from "#previousPackage.ts";

const validatePackage = Effect.fn("Changesets.validatePackage")(function* (
	pkg: WorkspacePackage,
	old: WorkspacePackage | undefined,
	release: Release | undefined,
	plan: ReleasePlan,
) {
	if (pkg.manifest.version !== (release?.to ?? old?.manifest.version ?? "0.0.0")) {
		return yield* new ChangesetError({
			message: `${pkg.manifest.name}: version differs from the release plan; restore versions and rerun releases apply, including published dependents.`,
		});
	}
	const previous = old?.changelog ?? "# Changelog\n";
	let date: string | undefined;
	let expected = previous;
	if (release !== undefined) {
		date = new RegExp(`^# Changelog\\n\\n## ${release.to.replaceAll(".", "\\.")} - (?<date>[^\\n]*)\\n`, "u").exec(pkg.changelog)?.groups?.date;
		if (date === undefined) {
			return yield* new ChangesetError({
				message: `${pkg.manifest.name}: release notes differ from releases apply; restore the new changelog heading and rerun releases apply.`,
			});
		}
		expected = yield* collectChangelog(previous, release, plan, date);
	}
	if (pkg.changelog !== expected) {
		return yield* new ChangesetError({
			message: `${pkg.manifest.name}: release notes differ from releases apply; restore released history and rerun releases apply from unchanged inputs.`,
		});
	}
	return date;
});

export const validateRelease = Effect.fn("Changesets.validateRelease")(function* (
	before: Workspace,
	after: Workspace,
	declarations: readonly Changeset[],
	plan: ReleasePlan,
) {
	let date: string | undefined;
	for (const pkg of after.packages) {
		const old = previousPackage(before, declarations, pkg);
		const release = plan.releases.find((candidate) => candidate.name === pkg.manifest.name);
		const headingDate = yield* validatePackage(pkg, old, release, plan);
		if (headingDate !== undefined) {
			if (date !== undefined && date !== headingDate) {
				return yield* new ChangesetError({ message: "Use the same UTC release date in every new changelog heading; rerun releases apply." });
			}
			date = headingDate;
		}
	}
});
