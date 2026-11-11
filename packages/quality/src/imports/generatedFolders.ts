import { posix } from "node:path";
import type { ImportEdge } from "#imports/graph.ts";

const LEADING_DOT = /^\.\//u;

const TRAILING_SLASHES = /\/+$/u;

export function generatedFolder(declared: string): string {
	return posix.normalize(declared).replace(LEADING_DOT, "").replace(TRAILING_SLASHES, "");
}

export function inGeneratedFolder(folders: readonly string[], path: string | undefined): boolean {
	return folders.some((folder) => path?.startsWith(`${folder}/`) === true);
}

// A generated client type-imports the module at its path outside the generated folder so the compiler checks they match; the import is erased.
export function ownModuleTypeImport(folders: readonly string[], edge: ImportEdge): boolean {
	if (!edge.type || edge.to.kind !== "file") {
		return false;
	}
	const target = edge.to.path;
	return folders.some(
		(folder) => edge.from.startsWith(`${folder}/`) && target === posix.join(posix.dirname(folder), edge.from.slice(folder.length + 1)),
	);
}

export function followedEdges(folders: readonly string[], edges: readonly ImportEdge[]): readonly ImportEdge[] {
	return edges.filter((edge) => !ownModuleTypeImport(folders, edge));
}
