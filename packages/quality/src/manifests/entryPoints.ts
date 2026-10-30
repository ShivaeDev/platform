import { posix } from "node:path";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import type { RuleInputs } from "#rule.ts";

export const SHIPPED_FIELDS = ["dependencies", "peerDependencies", "optionalDependencies"] as const;

export const DEPENDENCY_FIELDS = [...SHIPPED_FIELDS, "devDependencies"] as const;

export const PLATFORM = "@shivaedev/platform";

const ENTRY_POINTS = [
	{ name: PLATFORM, testOnly: false },
	{ name: "@shivaedev/test-story", testOnly: true },
] as const;

export interface EntryPoint {
	readonly declared: "development" | "shipped" | undefined;
	readonly name: string;
	readonly provides: ReadonlySet<string>;
	readonly testOnly: boolean;
}

export function dependencyNames(manifest: unknown, field: string): readonly string[] {
	const value: unknown = typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, field) : undefined;
	return typeof value === "object" && value !== null && !Array.isArray(value) ? Object.keys(value) : [];
}

async function installedManifest(inputs: Pick<RuleInputs, "readText">, directory: string, name: string, workspace: ReadonlyMap<string, string>) {
	const candidates = [
		...(workspace.has(name) ? [posix.join(workspace.get(name) ?? ".", "package.json")] : []),
		posix.join(directory, "node_modules", name, "package.json"),
		posix.join("node_modules", name, "package.json"),
	];
	for (const candidate of candidates) {
		const manifest = await readPackageManifest(inputs.readText, candidate);
		if (manifest !== undefined) {
			return manifest;
		}
	}
	return undefined;
}

function declaration(manifest: unknown, name: string): EntryPoint["declared"] {
	if (SHIPPED_FIELDS.some((field) => dependencyNames(manifest, field).includes(name))) {
		return "shipped";
	}
	return dependencyNames(manifest, "devDependencies").includes(name) ? "development" : undefined;
}

export function entryPointsOf(
	inputs: Pick<RuleInputs, "readText">,
	directory: string,
	manifest: unknown,
	workspace: ReadonlyMap<string, string>,
): Promise<readonly EntryPoint[]> {
	return Promise.all(
		ENTRY_POINTS.map(async ({ name, testOnly }) => ({
			declared: declaration(manifest, name),
			name,
			provides: new Set(dependencyNames(await installedManifest(inputs, directory, name, workspace), "dependencies")),
			testOnly,
		})),
	);
}

export function isApplication(manifest: unknown): boolean {
	return DEPENDENCY_FIELDS.some((field) => dependencyNames(manifest, field).includes(PLATFORM));
}

export function provider(entryPoints: readonly EntryPoint[], target: string, development: boolean, declaredOnly: boolean) {
	return entryPoints.find(
		(entry) =>
			entry.provides.has(target)
			&& (development || !entry.testOnly)
			&& (declaredOnly ? entry.declared === "shipped" || (entry.declared === "development" && development) : entry.declared === undefined),
	);
}
