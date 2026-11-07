import { Effect, FileSystem, Path } from "effect";
import type { ReleasePlan, Source, WorkspacePackage } from "@shivaedev/releases/model.ts";
import { scanCatalog } from "#quality/catalog.ts";
import { publishedManifest } from "#release/adapters/publishedManifest.ts";

const fields = ["dependencies", "optionalDependencies", "peerDependencies"] as const;
function isFramework(name: string) {
	return name === "effect" || name.startsWith("@effect/");
}

export const frameworkVersionsInput = Effect.fn("Release.frameworkVersionsInput")(function* (
	root: string,
	packages: readonly WorkspacePackage[],
	plan: ReleasePlan,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const catalog = new Map(
		scanCatalog(yield* fs.readFileString(path.join(root, "pnpm-workspace.yaml")))
			.entries.filter((entry) => entry.section === "catalog" && !entry.namedCatalog)
			.map((entry) => [entry.name, entry.value]),
	);
	const candidates = packages.filter(
		({ manifest }) =>
			!(manifest.private || plan.releases.some(({ name }) => name === manifest.name))
			&& fields.some((field) => Object.keys(manifest[field] ?? {}).some(isFramework)),
	);
	const drift = yield* Effect.forEach(
		candidates,
		Effect.fn("Release.frameworkDrift")(function* ({ manifest }) {
			const published = yield* publishedManifest(root, manifest.name, manifest.version);
			if (published === undefined) {
				return [];
			}
			const differs = fields.some((field) =>
				Object.entries(manifest[field] ?? {}).some(([name, range]) => {
					const expected = range === "catalog:" ? catalog.get(name) : range;
					return isFramework(name) && published[field]?.[name] !== expected;
				}),
			);
			return differs ? [manifest.name] : [];
		}),
		{ concurrency: 8 },
	);
	const names = drift.flat().sort();
	return names.length === 0
		? undefined
		: ({
				name: "release-framework-versions.md",
				text: `---\n${names.map((name) => `"${name}": patch`).join("\n")}\n---\n\n### Changed\n\n${names.map((name) => `- \`${name}\`: Align published Effect requirements with the workspace catalog.`).join("\n")}\n`,
			} satisfies Source);
});
