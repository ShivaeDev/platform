import type { Manifest } from "#package-check/model.ts";

const publishedDependencies = ["dependencies", "optionalDependencies", "peerDependencies"] as const;

export interface ReleasePackage {
	readonly before?: Manifest | undefined;
	readonly manifest: Manifest;
}

function dependencies(manifest: Manifest): Readonly<Record<string, string>> {
	return Object.assign({}, ...publishedDependencies.map((key) => manifest[key]));
}

function assertReleaseDependencies(manifest: Manifest, packages: readonly ReleasePackage[]): void {
	for (const [name, version] of Object.entries(dependencies(manifest))) {
		const target = packages.find((pkg) => pkg.manifest.name === name)?.manifest;
		if (target !== undefined && version !== "workspace:*" && version.replace(/^workspace:/u, "") !== target.version) {
			throw new Error(
				`${manifest.name}: update ${name} from ${version} to ${target.version} before releasing; published framework dependencies must agree.`,
			);
		}
	}
}

export function assertDependentReleases(packages: readonly ReleasePackage[]): void {
	const bumped = packages.filter(({ before, manifest }) => !manifest.private && before !== undefined && before.version !== manifest.version);
	const stale = packages.flatMap(({ before, manifest }) => {
		if (manifest.private || before === undefined || before.version !== manifest.version) {
			return [];
		}
		const required = { ...dependencies(before), ...dependencies(manifest) };
		return bumped
			.filter((pkg) => pkg.manifest.name in required)
			.map((pkg) => `${manifest.name} depends on ${pkg.manifest.name}@${pkg.manifest.version}`);
	});
	if (stale.length > 0) {
		throw new Error(
			`Release dependent packages in the same PR: ${stale.sort().join("; ")}. Bump each dependent, add a change fragment and run pnpm run changelog:release <package>; repeat for its dependents.`,
		);
	}
	for (const { manifest } of bumped) {
		assertReleaseDependencies(manifest, packages);
	}
}

function assertDependencyPins(manifest: Manifest, byName: ReadonlyMap<string, Manifest>, pins: Readonly<Record<string, string>>): void {
	for (const [dependency, version] of Object.entries(dependencies(manifest))) {
		const target = byName.get(dependency);
		if (target === undefined) {
			continue;
		}
		const expected = version === "workspace:*" ? target.version : version.replace(/^workspace:/u, "");
		if (pins[dependency] !== expected) {
			throw new Error(
				`Starter published-versions.json: ${manifest.name}@${manifest.version} depends on ${dependency}@${expected}, but its pin is ${pins[dependency] ?? "missing"}. Align the dependency release and starter pin, then release create-app.`,
			);
		}
	}
}

export function assertStarterPins(packages: readonly Manifest[], pins: Readonly<Record<string, string>>): void {
	const byName = new Map(packages.filter((manifest) => !manifest.private).map((manifest) => [manifest.name, manifest]));
	for (const [name, pin] of Object.entries(pins)) {
		const manifest = byName.get(name);
		if (manifest === undefined || pin !== manifest.version) {
			throw new Error(
				`Starter published-versions.json: ${name}@${pin} must pin the current release ${manifest?.version ?? "of a published workspace package"}. Update the pin and release create-app.`,
			);
		}
		assertDependencyPins(manifest, byName, pins);
	}
}
