import { Effect } from "effect";
import { catalogEntries } from "#adapters/catalogEntries.ts";
import { catalogWorkspace } from "#adapters/catalogWorkspace.ts";
import { manifestFiles, readPackageManifest } from "#adapters/manifestInventory.ts";
import { defineRule, type Finding } from "#rule.ts";

const SECTIONS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
const EXACT =
	/^(?:npm:(?:@[^/\s]+\/)?[^@\s]+@)?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*)?(?:\+[\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*)?$/u;

function dependencyFinding(
	file: string,
	section: string,
	name: string,
	version: string,
	catalogs: ReturnType<typeof catalogEntries>,
): readonly Finding[] {
	if (version.startsWith("workspace:")) {
		return [];
	}
	const catalog = version.startsWith("catalog:") ? version.slice("catalog:".length) : undefined;
	const valid =
		catalog === undefined
			? !catalogs.present && EXACT.test(version)
			: catalogs.entries.some((entry) => entry.catalog === catalog && entry.name === name);
	return valid
		? []
		: [
				{
					file,
					message: `${section} entry "${name}: ${version}" must ${catalogs.present || catalog !== undefined ? 'use "catalog:" (or a named catalog) with an entry for this dependency in pnpm-workspace.yaml' : "pin an exact npm version, including for npm aliases"}. Use "workspace:" for workspace dependencies; replace "file:" and "link:" with npm versions or workspace/catalog references.`,
					subject: `${section}.${name}`,
				},
			];
}

export const manifestsDependencyPins = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const workspace = yield* catalogWorkspace(inputs);
			const catalogs = catalogEntries(workspace.text);
			const findings: Finding[] = catalogs.findings.map((finding) => ({ ...finding, file: workspace.file }));
			for (const entry of catalogs.entries) {
				if (!EXACT.test(entry.version)) {
					findings.push({
						file: workspace.file,
						line: entry.line,
						message: `Catalog entry "${entry.name}: ${entry.version}" is not an exact version. Pin one version, including for npm aliases.`,
					});
				}
			}
			for (const file of manifestFiles(inputs)) {
				const manifest = yield* Effect.promise(() => readPackageManifest(inputs.readText, file));
				findings.push(
					...SECTIONS.flatMap((section) =>
						Object.entries(manifest?.[section] ?? {}).flatMap(([name, version]) => dependencyFinding(file, section, name, version, catalogs)),
					),
				);
			}
			return findings;
		}),
	description:
		"Pin external dependencies to exact versions; use catalog references when pnpm-workspace.yaml declares catalogs, and pin their entries too.",
	id: "manifests/dependency-pins",
});
