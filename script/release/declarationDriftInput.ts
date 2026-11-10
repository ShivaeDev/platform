import { Effect, FileSystem, Path } from "effect";
import type { ReleasePlan, Source, WorkspacePackage } from "@shivaedev/releases/model.ts";
import { type Declarations, declarationChanges, declarationFields } from "#lib/declarationChanges.ts";
import { scanCatalog } from "#quality/catalog.ts";
import { publishedManifest } from "#release/adapters/publishedManifest.ts";

const CATALOG = "catalog:";
const WORKSPACE = "workspace:";

export const declarationDriftInput = Effect.fn("Release.declarationDriftInput")(function* (
	root: string,
	packages: readonly WorkspacePackage[],
	plan: ReleasePlan,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const catalogs = new Map(
		scanCatalog(yield* fs.readFileString(path.join(root, "pnpm-workspace.yaml")))
			.entries.filter((entry) => entry.section === "catalog")
			.map((entry) => [`${entry.catalog}\n${entry.name}`, entry.value]),
	);
	const versions = new Map(packages.map(({ manifest }) => [manifest.name, manifest.version]));
	function packed(name: string, specifier: string) {
		if (specifier.startsWith(CATALOG)) {
			return catalogs.get(`${specifier.slice(CATALOG.length) || "default"}\n${name}`) ?? specifier;
		}
		const version = versions.get(name);
		if (!specifier.startsWith(WORKSPACE) || version === undefined) {
			return specifier;
		}
		const range = specifier.slice(WORKSPACE.length);
		if (range === "*") {
			return version;
		}
		return range === "^" || range === "~" ? `${range}${version}` : range;
	}
	const candidates = packages.filter(({ manifest }) => !(manifest.private || plan.releases.some(({ name }) => name === manifest.name)));
	const drift = yield* Effect.forEach(
		candidates,
		Effect.fn("Release.declarationDrift")(function* ({ manifest }) {
			const published = yield* publishedManifest(root, manifest.name, manifest.version);
			if (published === undefined) {
				return [];
			}
			const current: Declarations = Object.fromEntries(
				declarationFields.map((field) => [
					field,
					Object.fromEntries(Object.entries(manifest[field] ?? {}).map(([name, specifier]) => [name, packed(name, specifier)])),
				]),
			);
			return declarationChanges(published, current).length > 0 ? [manifest.name] : [];
		}),
		{ concurrency: 8 },
	);
	const names = drift.flat().sort();
	return names.length === 0
		? undefined
		: ({
				name: "release-declared-dependencies.md",
				text: `---\n${names.map((name) => `"${name}": patch`).join("\n")}\n---\n\n### Changed\n\n${names.map((name) => `- \`${name}\`: Align published dependency requirements with the workspace.`).join("\n")}\n`,
			} satisfies Source);
});
