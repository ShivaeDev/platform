import { join, posix } from "node:path";
import ts from "typescript";
import { type Project, projectsFor } from "#adapters/imports/projects.ts";
import { isDeclarationFile, presumedTarget, resolveImport } from "#adapters/imports/resolve.ts";
import { ambientModules } from "#imports/ambient.ts";
import { type ImportRequest, importsOf } from "#imports/extract.ts";
import type { ImportEdge, ImportGraph, UnresolvedImport } from "#imports/graph.ts";
import type { RuleInputs, SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

const QUERY = /\?.*$/u;

function relativeTarget(from: string, request: ImportRequest): string | undefined {
	const relative = request.kind === "path-reference" || request.specifier.startsWith("./") || request.specifier.startsWith("../");
	return relative ? posix.join(posix.dirname(from), request.specifier.replace(QUERY, "")) : undefined;
}

// A relative import or a package import of a missing file still names a path, so fences see it before its generator writes it.
function missingTarget(root: string, from: string, request: ImportRequest, project: Project): string | undefined {
	const target = presumedTarget(root, request, join(root, from), project) ?? relativeTarget(from, request);
	return target === undefined || target.startsWith("../") ? undefined : target;
}

interface Parsed {
	readonly file: SourceFile;
	readonly path: string;
	readonly syntax: ts.SourceFile;
}

function parsedIn(root: string, files: readonly SourceFile[]): readonly Parsed[] {
	return files.flatMap((file) => {
		const syntax = parse(file);
		return syntax === undefined ? [] : [{ file, path: join(root, file.path), syntax }];
	});
}

export type SourceGraph = Pick<ImportGraph, "configFindings" | "edges" | "modules" | "unresolved"> & {
	// Files the sources reach outside the inventory resolve with the sources' projects and ambient modules.
	readonly follow: (files: readonly SourceFile[]) => readonly ImportEdge[];
};

export function graph(inputs: RuleInputs, root: string): SourceGraph {
	const projectOf = projectsFor(root);
	const parsed = parsedIn(root, inputs.sources);
	const ambient = ambientModules(parsed);
	function walk(files: readonly Parsed[]): Pick<ImportGraph, "edges" | "unresolved"> {
		const edges: ImportEdge[] = [];
		const unresolved: UnresolvedImport[] = [];
		for (const { file, path, syntax } of files) {
			const project = projectOf(path);
			syntax.impliedNodeFormat = ts.getImpliedNodeFormatForFile(path, undefined, ts.sys, project.options);
			for (const request of importsOf(syntax, isDeclarationFile(file.path), project.options)) {
				const to = resolveImport(root, ambient, request, path, project);
				if (to === undefined) {
					const missing = missingTarget(root, file.path, request, project);
					unresolved.push({ ...request, from: file.path, missing });
					edges.push(...(missing === undefined ? [] : [{ ...request, from: file.path, to: { kind: "file" as const, path: missing } }]));
				} else {
					edges.push({ ...request, from: file.path, to });
				}
			}
		}
		return { edges, unresolved };
	}
	const { edges, unresolved } = walk(parsed);
	return {
		configFindings: projectOf.findings,
		edges,
		follow: (files) => walk(parsedIn(root, files)).edges,
		modules: parsed.map(({ file }) => file.path),
		unresolved,
	};
}
