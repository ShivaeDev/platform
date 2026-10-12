import { Result, Schema } from "effect";
import { jsonDecoder } from "#lint/adapters/json.ts";
import type { Inventory } from "#lint/inventory.ts";

export interface WorkspacePackage {
	readonly name: string;
	readonly root: string;
}

const PACKAGE_ROOT = /^(?<root>(?:packages|examples)\/[^/]+)\/package\.json$/u;

const decodeName = jsonDecoder(Schema.Struct({ name: Schema.optional(Schema.String) }));

function packageAt(path: string, raw: string): readonly WorkspacePackage[] {
	const root = PACKAGE_ROOT.exec(path)?.groups?.root;
	const decoded = decodeName(raw);
	if (root === undefined || Result.isFailure(decoded) || decoded.success.name === undefined) {
		return [];
	}
	return [{ name: decoded.success.name, root }];
}

export function workspacePackages(inventory: Inventory): readonly WorkspacePackage[] {
	return inventory.manifests.flatMap((manifest) => packageAt(manifest.path, manifest.raw));
}

export function packageOf(packages: readonly WorkspacePackage[], path: string): WorkspacePackage | undefined {
	return packages.reduce<WorkspacePackage | undefined>(
		(found, candidate) =>
			path.startsWith(`${candidate.root}/`) && (found === undefined || candidate.root.length > found.root.length) ? candidate : found,
		undefined,
	);
}
