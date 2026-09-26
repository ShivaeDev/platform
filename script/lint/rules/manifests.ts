import { Result, Schema } from "effect";
import { jsonDecoder } from "#lint/adapters/json.ts";
import type { Inventory, TextFile } from "#lint/inventory.ts";
import type { Violation } from "#lint/violation.ts";
import { workspacePackages } from "#lint/workspace.ts";

const DEPENDENCY_KEYS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
const IGNORED_OVERRIDE_KEYS = ["overrides", "pnpm", "resolutions"] as const;
const DependencyMap = Schema.Record(Schema.String, Schema.Unknown);
const decodeManifest = jsonDecoder(
	Schema.Struct({
		dependencies: Schema.optional(DependencyMap),
		devDependencies: Schema.optional(DependencyMap),
		optionalDependencies: Schema.optional(DependencyMap),
		overrides: Schema.optional(Schema.Unknown),
		peerDependencies: Schema.optional(DependencyMap),
		pnpm: Schema.optional(Schema.Unknown),
		resolutions: Schema.optional(Schema.Unknown),
	}),
);

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
				? `${key} entry "${name}": "${String(spec)}" points at a workspace package. Internal packages must use "workspace:*"; packing pins the workspace package's own version.`
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

const ignoredOverrideViolations = (manifest: TextFile, present: (key: (typeof IGNORED_OVERRIDE_KEYS)[number]) => boolean): readonly Violation[] =>
	IGNORED_OVERRIDE_KEYS.filter(present).map((key) => ({
		file: manifest.path,
		line: undefined,
		message: `"${key}" is not read by pnpm 11, so its pins would silently do nothing. Put overrides in pnpm-workspace.yaml as "catalog:" entries.`,
		rule: "manifests/catalog-overrides",
	}));

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
	const fields = decoded.success;
	return [
		...ignoredOverrideViolations(manifest, (key) => fields[key] !== undefined),
		...DEPENDENCY_KEYS.flatMap((key) => dependencyViolations(manifest, key, internal, fields[key])),
	];
};

export const manifestViolations = (inventory: Inventory): readonly Violation[] => {
	const internal = new Set(workspacePackages(inventory).map(({ name }) => name));
	return inventory.manifests.flatMap((manifest) => oneManifestViolations(manifest, internal));
};
