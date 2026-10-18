import { Effect } from "effect";
import type { ChangesetConfig } from "#config.ts";
import { attempt, requireThat } from "#error.ts";
import type { Bump, PackageManifest, ReleasePlan, Source, WorkspacePackage } from "#model.ts";
import { parseChangeset } from "#parser.ts";
import { readWorkspace } from "#workspace.ts";

const rank = { major: 2, minor: 1, patch: 0 };
export function publishedDependencies(manifest: PackageManifest): readonly string[] {
	return Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies });
}
function nextVersion(name: string, version: string, bump: Bump): string {
	const match = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)$/u.exec(version);
	requireThat(match !== null, `${name}: use a stable major.minor.patch version before planning a release; found ${version}.`);
	const major = Number(match?.groups?.major);
	const minor = Number(match?.groups?.minor);
	const patch = Number(match?.groups?.patch);
	requireThat(major !== 0 || bump !== "major", `${name}: major is not allowed on a 0.x package; use minor for breaking changes.`);
	if (bump === "major") {
		return `${major + 1}.0.0`;
	}
	return bump === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}
function requestedBumps(packages: readonly WorkspacePackage[], sources: readonly Source[]): Map<string, Bump> {
	const bumps = new Map<string, Bump>();
	for (const source of sources) {
		for (const [name, bump] of Object.entries(parseChangeset(source).packages)) {
			const pkg = packages.find((candidate) => candidate.manifest.name === name);
			requireThat(pkg !== undefined, `${source.name}: unknown package ${name}; fix the name or include its directory in config.packages.`);
			requireThat(!pkg?.manifest.private, `${source.name}: ${name} is private; remove it from release frontmatter.`);
			if (pkg !== undefined) {
				nextVersion(name, pkg.manifest.version, bump);
			}
			const previous = bumps.get(name);
			if (previous === undefined || rank[bump] > rank[previous]) {
				bumps.set(name, bump);
			}
		}
	}
	return bumps;
}
export function computePlan(packages: readonly WorkspacePackage[], sources: readonly Source[]): ReleasePlan {
	const bumps = requestedBumps(packages, sources);
	let changed = true;
	while (changed) {
		changed = false;
		for (const { manifest } of packages) {
			if (!(manifest.private || bumps.has(manifest.name)) && publishedDependencies(manifest).some((name) => bumps.has(name))) {
				bumps.set(manifest.name, "patch");
				changed = true;
			}
		}
	}
	const releases = [...bumps]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, bump]) => {
			const pkg = packages.find((candidate) => candidate.manifest.name === name);
			if (pkg === undefined) {
				throw new Error(`Package ${name} disappeared while planning.`);
			}
			return { bump, directory: pkg.directory, from: pkg.manifest.version, name, to: nextVersion(name, pkg.manifest.version, bump) };
		});
	return { changesets: [...sources].sort((left, right) => left.name.localeCompare(right.name)), releases };
}
export function summarizePlan(plan: ReleasePlan): string {
	return plan.releases.length === 0
		? "No pending releases."
		: plan.releases.map((release) => `${release.name}: ${release.from} -> ${release.to} (${release.bump})`).join("\n");
}
export const planRelease = Effect.fn("Changesets.planRelease")(function* (root: string, config: ChangesetConfig = {}) {
	const workspace = yield* readWorkspace(root, config);
	return yield* attempt(() => computePlan(workspace.packages, workspace.changesets));
});
