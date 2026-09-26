import { Result, Schema } from "effect";
import { jsonDecoder } from "#lint/adapters/json.ts";
import type { Inventory, TextFile } from "#lint/inventory.ts";
import type { Violation } from "#lint/violation.ts";
import { workspacePackages } from "#lint/workspace.ts";

const EXACT_VERSION = /^(npm:.+@)?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const CATALOG_HEADING = /^catalogs?:/;
const OVERRIDES_HEADING = /^overrides:/;
const TOP_LEVEL_KEY = /^\S/;
const CATALOG_ENTRY = /^\s+(?=[^\s#])"?([^":]+)"?:\s*(\S.*)$/;
const DEPENDENCY_KEYS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
const DependencyMap = Schema.Record(Schema.String, Schema.Unknown);
const decodeManifest = jsonDecoder(
	Schema.Struct({
		dependencies: Schema.optional(DependencyMap),
		devDependencies: Schema.optional(DependencyMap),
		optionalDependencies: Schema.optional(DependencyMap),
		peerDependencies: Schema.optional(DependencyMap),
	}),
);

const sectionLines = (workspace: string, heading: RegExp): readonly string[] => {
	const collected: string[] = [];
	let inSection = false;
	for (const line of workspace.split("\n")) {
		if (heading.test(line)) {
			inSection = true;
			continue;
		}
		if (TOP_LEVEL_KEY.test(line)) {
			inSection = false;
		}
		if (inSection) {
			collected.push(line);
		}
	}
	return collected;
};

const entryValue = (entry: RegExpExecArray): string => (entry[2] ?? "").replace(/^["']|["']$/g, "");

const catalogViolation = (line: string): readonly Violation[] => {
	const entry = CATALOG_ENTRY.exec(line);
	if (entry === null) {
		return [];
	}
	const value = entryValue(entry);
	if (EXACT_VERSION.test(value)) {
		return [];
	}
	return [
		{
			file: "pnpm-workspace.yaml",
			line: undefined,
			message: `catalog entry "${entry[1]}: ${value}" is not an exact version. Ranges are banned; pin the version and let upgrades be visible diffs.`,
			rule: "manifests/exact-catalog-version",
		},
	];
};

const catalogViolations = (workspace: string): readonly Violation[] => sectionLines(workspace, CATALOG_HEADING).flatMap(catalogViolation);

const overrideViolation = (line: string): readonly Violation[] => {
	const entry = CATALOG_ENTRY.exec(line);
	if (entry === null || entryValue(entry).startsWith("catalog:")) {
		return [];
	}
	return [
		{
			file: "pnpm-workspace.yaml",
			line: undefined,
			message: `override "${entry[1]}: ${entryValue(entry)}" names a version outside the catalog. Pin the version in the catalog and override with "catalog:".`,
			rule: "manifests/catalog-overrides",
		},
	];
};

const overrideViolations = (workspace: string): readonly Violation[] => sectionLines(workspace, OVERRIDES_HEADING).flatMap(overrideViolation);

const dependencyViolation = (manifest: TextFile, key: string, internal: ReadonlySet<string>, name: string, spec: unknown): readonly Violation[] => {
	const allowed = internal.has(name) ? spec === "workspace:*" : typeof spec === "string" && spec.startsWith("catalog:");
	if (allowed) {
		return [];
	}
	return [
		{
			file: manifest.path,
			line: undefined,
			message: internal.has(name)
				? `${key} entry "${name}": "${String(spec)}" names a version. Use "workspace:*"; packing pins the workspace package's own version.`
				: `${key} entry "${name}": "${String(spec)}" bypasses the catalog. Use "catalog:" and pin the exact version in pnpm-workspace.yaml.`,
			rule: "manifests/catalog-only",
		},
	];
};

const dependencyViolations = (
	manifest: TextFile,
	key: string,
	internal: ReadonlySet<string>,
	deps: Readonly<Record<string, unknown>> | undefined,
): readonly Violation[] => {
	if (deps === undefined) {
		return [];
	}
	return Object.entries(deps).flatMap(([name, spec]) => dependencyViolation(manifest, key, internal, name, spec));
};

const oneManifestViolations = (manifest: TextFile, internal: ReadonlySet<string>): readonly Violation[] => {
	const decoded = decodeManifest(manifest.raw);
	if (Result.isFailure(decoded)) {
		return [
			{
				file: manifest.path,
				line: undefined,
				message: "is not a readable JSON manifest.",
				rule: "manifests/unreadable",
			},
		];
	}
	return DEPENDENCY_KEYS.flatMap((key) => dependencyViolations(manifest, key, internal, decoded.success[key]));
};

export const manifestViolations = (inventory: Inventory): readonly Violation[] => {
	const internal = new Set(workspacePackages(inventory).map(({ name }) => name));
	return [
		...catalogViolations(inventory.workspaceCatalog),
		...overrideViolations(inventory.workspaceCatalog),
		...inventory.manifests.flatMap((manifest) => oneManifestViolations(manifest, internal)),
	];
};
