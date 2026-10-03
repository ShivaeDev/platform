import { posix } from "node:path";
import type { ImportGraph, UnresolvedImport } from "./graph.ts";

const QUERY = /\?.*$/u;

const LEADING_DOT = /^\.\//u;

const TRAILING_SLASHES = /\/+$/u;

const NODE_MODULES = "node_modules";

function targetOf(request: UnresolvedImport): string | undefined {
	const relative = request.specifier.startsWith("./") || request.specifier.startsWith("../");
	return relative ? posix.join(posix.dirname(request.from), request.specifier.replace(QUERY, "")) : undefined;
}

function under(folder: string, path: string | undefined): boolean {
	return path?.startsWith(`${folder}/`) === true;
}

function issueOf(graph: ImportGraph, folder: string): string | undefined {
	if (folder === "" || folder.startsWith("../") || posix.isAbsolute(folder)) {
		return `"${folder}" is no folder inside the repository`;
	}
	if (folder.split("/").includes(NODE_MODULES)) {
		return `"${folder}" lies in node_modules, which holds installed packages, not generated output`;
	}
	const named =
		graph.unresolved.some((request) => under(folder, targetOf(request)))
		|| graph.edges.some((edge) => edge.to.kind === "file" && under(folder, edge.to.path));
	return named ? undefined : `"${folder}" holds no file that an import names`;
}

// A generated folder may be empty until its generator runs, so a relative import of a missing file in it resolves.
export function withoutGenerated(graph: ImportGraph, declared: readonly string[]): readonly UnresolvedImport[] {
	const folders = declared.map((folder) => posix.normalize(folder).replace(LEADING_DOT, "").replace(TRAILING_SLASHES, ""));
	const issues = folders.flatMap((folder) => issueOf(graph, folder) ?? []);
	if (issues.length > 0) {
		throw new Error(`the generated folders are invalid:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
	}
	return graph.unresolved.filter((request) => !folders.some((folder) => under(folder, targetOf(request))));
}
