import { posix } from "node:path";
import type { ImportEdge } from "#imports/graph.ts";
import type { WorkspacePackage } from "#imports/workspace.ts";

const GENERATED = "src/generated";

// The generator of @shivaedev/build writes each project's output to src/generated, at the application root and in every workspace package.
export function generatedFolders(packages: readonly WorkspacePackage[]): readonly string[] {
	return [GENERATED, ...packages.map((owner) => posix.join(owner.directory, GENERATED))];
}

function generatedFolderOf(folders: readonly string[], path: string): string | undefined {
	return folders.find((folder) => path.startsWith(`${folder}/`));
}

export function generatedFrom(folders: readonly string[], path: string): string | undefined {
	const folder = generatedFolderOf(folders, path);
	return folder === undefined ? undefined : posix.join(posix.dirname(folder), path.slice(folder.length + 1));
}

// A generated client type-imports its module so the compiler checks they match; the import is erased.
export function ownModuleTypeImport(folders: readonly string[], edge: ImportEdge): boolean {
	return edge.type && edge.to.kind === "file" && generatedFrom(folders, edge.from) === edge.to.path;
}

export function followedEdges(folders: readonly string[], edges: readonly ImportEdge[]): readonly ImportEdge[] {
	return edges.filter((edge) => !ownModuleTypeImport(folders, edge));
}
