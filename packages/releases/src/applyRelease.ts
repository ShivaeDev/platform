import { join } from "node:path";
import { Clock, Effect, FileSystem } from "effect";
import { collectChangelog } from "#collectChangelog.ts";
import type { ChangesetConfig } from "#config.ts";
import { ChangesetError } from "#error.ts";
import type { ReleasePlan, WorkspacePackage } from "#model.ts";
import { computePlan } from "#planner.ts";
import { readWorkspace } from "#workspace.ts";

const updatedPackage = Effect.fn("Changesets.updatedPackage")(function* (pkg: WorkspacePackage, plan: ReleasePlan, version: string) {
	const json: Record<string, unknown> = { ...pkg.json, version };
	for (const key of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
		const dependencies = pkg.manifest[key];
		if (dependencies !== undefined) {
			json[key] = Object.fromEntries(yield* Effect.forEach(Object.entries(dependencies), (entry) => updatedRange(pkg, plan, entry)));
		}
	}
	return `${JSON.stringify(json, null, "\t")}\n`;
});
const updatedRange = Effect.fn("Changesets.updatedRange")(function* (
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

export const applyRelease = Effect.fn("Changesets.applyRelease")(function* (root: string, config: ChangesetConfig = {}) {
	const fs = yield* FileSystem.FileSystem;
	const workspace = yield* readWorkspace(root, config);
	const plan = yield* computePlan(workspace.packages, workspace.changesets);
	if (plan.releases.length === 0) {
		return plan;
	}
	const date = new Date(yield* Clock.currentTimeMillis).toISOString().slice(0, 10);
	const writes = (yield* Effect.forEach(
		plan.releases,
		Effect.fn("Changesets.releaseWrites")(function* (release) {
			const pkg = workspace.packages.find((candidate) => candidate.manifest.name === release.name);
			if (pkg === undefined) {
				return yield* new ChangesetError({ message: `Package ${release.name} disappeared while applying.` });
			}
			return [
				{ path: join(root, release.directory, "package.json"), text: yield* updatedPackage(pkg, plan, release.to) },
				{ path: join(root, release.directory, "CHANGELOG.md"), text: yield* collectChangelog(pkg.changelog, release, plan, date) },
			];
		}),
	)).flat();
	for (const write of writes) {
		yield* fs.writeFileString(write.path, write.text);
	}
	yield* Effect.forEach(plan.changesets, (source) => fs.remove(join(root, ".changeset", source.name)));
	for (const hook of config.hooks ?? []) {
		yield* hook({ plan, root });
	}
	return plan;
});
