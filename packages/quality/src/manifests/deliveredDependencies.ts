import type { PackageManifest } from "#PackageManifest.ts";

const MANIFEST_EXPORT = "./package.json";

// A package that exports only its manifest and holds no sources ships no code: the dependencies it installs are what it delivers.
export function deliveredDependencies(manifest: PackageManifest, sources: readonly string[]): readonly string[] {
	const exported = typeof manifest.exports === "object" && manifest.exports !== null ? Object.keys(manifest.exports) : [];
	const shell =
		sources.length === 0 && manifest.bin === undefined && manifest.main === undefined && exported.length === 1 && exported[0] === MANIFEST_EXPORT;
	return shell ? Object.keys(manifest.dependencies ?? {}) : [];
}
