import { Effect } from "effect";
import type { ChangesetConfig } from "#config.ts";
import { ChangesetError } from "#error.ts";
import type { Bump, PackageManifest, Release, ReleasePlan, Source, WorkspacePackage } from "#model.ts";
import { type Changeset, parseChangeset } from "#parser.ts";
import { readWorkspace } from "#workspace.ts";

const rank = { major: 2, minor: 1, patch: 0 };
export function publishedDependencies(manifest: PackageManifest): readonly string[] {
	return Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies });
}
const nextVersion = Effect.fn("Changesets.nextVersion")(function* (name: string, version: string, bump: Bump) {
	const match = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)$/u.exec(version);
	if (match === null) {
		return yield* new ChangesetError({ message: `${name}: use a stable major.minor.patch version before planning a release; found ${version}.` });
	}
	const major = Number(match.groups?.major);
	const minor = Number(match.groups?.minor);
	const patch = Number(match.groups?.patch);
	if (major === 0 && bump === "major") {
		return yield* new ChangesetError({ message: `${name}: major is not allowed on a 0.x package; use minor for breaking changes.` });
	}
	if (bump === "major") {
		return `${major + 1}.0.0`;
	}
	return bump === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
});
const requestedBumps = Effect.fn("Changesets.requestedBumps")(function* (packages: readonly WorkspacePackage[], sources: readonly Source[]) {
	const bumps = new Map<string, Bump>();
	for (const source of sources) {
		const changeset = yield* parseChangeset(source);
		for (const [name, bump] of Object.entries(changeset.packages)) {
			yield* validateRequest(packages, name, bump, changeset);
			const previous = bumps.get(name);
			if (previous === undefined || rank[bump] > rank[previous]) {
				bumps.set(name, bump);
			}
		}
	}
	return bumps;
});
const validateRequest = Effect.fn("Changesets.validateRequest")(function* (
	packages: readonly WorkspacePackage[],
	name: string,
	bump: Bump,
	changeset: Changeset,
) {
	const pkg = packages.find((candidate) => candidate.manifest.name === name);
	if (pkg === undefined) {
		return yield* new ChangesetError({
			message: `${changeset.name}: unknown package ${name}; fix the name or include its directory in config.packages.`,
		});
	}
	if (pkg.manifest.private) {
		return yield* new ChangesetError({ message: `${changeset.name}: ${name} is private; remove it from release frontmatter.` });
	}
	yield* nextVersion(name, pkg.manifest.version, bump);
	const needsMinor = changeset.entries.some((entry) => entry.section === "Added" || entry.section === "Breaking");
	if (pkg.manifest.version.startsWith("0.") && needsMinor && rank[bump] < rank.minor) {
		return yield* new ChangesetError({
			message: `${changeset.name}: ${name} has a ${bump} bump but its sections require at least minor; use minor for Added or Breaking before 1.0.`,
		});
	}
});
export const computePlan = Effect.fn("Changesets.computePlan")(function* (packages: readonly WorkspacePackage[], sources: readonly Source[]) {
	const bumps = yield* requestedBumps(packages, sources);
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
	const releases: Release[] = [];
	for (const [name, bump] of [...bumps].sort(([left], [right]) => left.localeCompare(right))) {
		const pkg = packages.find((candidate) => candidate.manifest.name === name);
		if (pkg === undefined) {
			return yield* new ChangesetError({ message: `Package ${name} disappeared while planning.` });
		}
		releases.push({ bump, directory: pkg.directory, from: pkg.manifest.version, name, to: yield* nextVersion(name, pkg.manifest.version, bump) });
	}
	return { changesets: [...sources].sort((left, right) => left.name.localeCompare(right.name)), releases } satisfies ReleasePlan;
});
export function summarizePlan(plan: ReleasePlan): string {
	return plan.releases.length === 0
		? "No pending releases."
		: plan.releases.map((release) => `${release.name}: ${release.from} -> ${release.to} (${release.bump})`).join("\n");
}
export const planRelease = Effect.fn("Changesets.planRelease")(function* (root: string, config: ChangesetConfig = {}) {
	const workspace = yield* readWorkspace(root, config);
	return yield* computePlan(workspace.packages, workspace.changesets);
});
