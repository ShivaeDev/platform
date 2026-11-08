import type { Package } from "#package-check/model.ts";

export function matchingWorkspaceTarballs(packages: readonly Package[], pins: Readonly<Record<string, string>>, preferred: readonly string[]) {
	const names = new Set(preferred);
	return Object.fromEntries(
		packages
			.filter(({ manifest }) => names.has(manifest.name) && pins[manifest.name] === manifest.version)
			.map(({ manifest, tarball }) => [manifest.name, tarball]),
	);
}
