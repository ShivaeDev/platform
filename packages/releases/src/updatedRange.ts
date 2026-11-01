import { Effect } from "effect";
import { ChangesetError } from "#error.ts";
import type { ReleasePlan, WorkspacePackage } from "#model.ts";

export const updatedRange = Effect.fn("Changesets.updatedRange")(function* (
	pkg: WorkspacePackage,
	plan: ReleasePlan,
	[name, range]: readonly [string, string],
) {
	const target = plan.releases.find((release) => release.name === name);
	if (target === undefined || ["workspace:*", "workspace:^", "workspace:~"].includes(range)) {
		return [name, range];
	}
	const match = /^(?<prefix>(?:workspace:)?[~^]?)\d+\.\d+\.\d+$/u.exec(range);
	if (match === null) {
		return yield* new ChangesetError({
			message: `${pkg.manifest.name}: replace ${name}'s ${range} range with an exact version, ^version, ~version or workspace:* before applying a release.`,
		});
	}
	return [name, `${match.groups?.prefix ?? ""}${target.to}`];
});
