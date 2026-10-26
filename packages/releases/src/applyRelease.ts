import { join } from "node:path";
import { Clock, Effect, FileSystem } from "effect";
import { collectChangelog } from "#collectChangelog.ts";
import type { ChangesetConfig } from "#config.ts";
import { attempt, requireThat } from "#error.ts";
import type { ReleasePlan, WorkspacePackage } from "#model.ts";
import { computePlan } from "#planner.ts";
import { readWorkspace } from "#workspace.ts";

function updatedPackage(pkg: WorkspacePackage, plan: ReleasePlan, version: string) {
	const json: Record<string, unknown> = { ...pkg.json, version };
	for (const key of ["dependencies", "optionalDependencies", "peerDependencies"] as const) {
		const dependencies = pkg.manifest[key];
		if (dependencies !== undefined) {
			json[key] = Object.fromEntries(
				Object.entries(dependencies).map(([name, range]) => {
					const target = plan.releases.find((release) => release.name === name);
					if (target === undefined || ["workspace:*", "workspace:^", "workspace:~"].includes(range)) {
						return [name, range];
					}
					const match = /^(?<prefix>(?:workspace:)?[~^]?)\d+\.\d+\.\d+$/u.exec(range);
					requireThat(
						match !== null,
						`${pkg.manifest.name}: replace ${name}'s ${range} range with an exact version, ^version, ~version or workspace:* before applying a release.`,
					);
					const prefix = match?.groups?.prefix ?? "";
					return [name, `${prefix}${target.to}`];
				}),
			);
		}
	}
	return `${JSON.stringify(json, null, "\t")}\n`;
}
export const applyRelease = Effect.fn("Changesets.applyRelease")(function* (root: string, config: ChangesetConfig = {}) {
	const fs = yield* FileSystem.FileSystem;
	const workspace = yield* readWorkspace(root, config);
	const plan = yield* attempt(() => computePlan(workspace.packages, workspace.changesets));
	if (plan.releases.length === 0) {
		return plan;
	}
	const date = new Date(yield* Clock.currentTimeMillis).toISOString().slice(0, 10);
	const writes = yield* attempt(() =>
		plan.releases.flatMap((release) => {
			const pkg = workspace.packages.find((candidate) => candidate.manifest.name === release.name);
			if (pkg === undefined) {
				throw new Error(`Package ${release.name} disappeared while applying.`);
			}
			return [
				{ path: join(root, release.directory, "package.json"), text: updatedPackage(pkg, plan, release.to) },
				{ path: join(root, release.directory, "CHANGELOG.md"), text: collectChangelog(pkg.changelog, release, plan, date) },
			];
		}),
	);
	for (const write of writes) {
		yield* fs.writeFileString(write.path, write.text);
	}
	yield* Effect.forEach(plan.changesets, (source) => fs.remove(join(root, ".changeset", source.name)));
	for (const hook of config.hooks ?? []) {
		yield* hook({ plan, root });
	}
	return plan;
});
