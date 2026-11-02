import { join, posix } from "node:path";
import ts from "typescript";
import { ambientModules } from "#imports/ambient.ts";
import { type ImportRequest, importsOf } from "#imports/extract.ts";
import type { ImportEdge, ImportGraph, UnresolvedImport } from "#imports/graph.ts";
import type { RuleInputs } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { type Project, projectsFor } from "./projects.ts";
import { isDeclarationFile, presumedTarget, resolveImport } from "./resolve.ts";

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

export function graph(inputs: RuleInputs, root: string): Pick<ImportGraph, "configFindings" | "edges" | "modules" | "unresolved"> {
	const projectOf = projectsFor(root);
	const parsed = inputs.sources.flatMap((file) => {
		const syntax = parse(file);
		return syntax === undefined ? [] : [{ file, path: join(root, file.path), syntax }];
	});
	const ambient = ambientModules(parsed);
	const edges: ImportEdge[] = [];
	const unresolved: UnresolvedImport[] = [];
	for (const { file, path, syntax } of parsed) {
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
	return { configFindings: projectOf.findings, edges, modules: parsed.map(({ file }) => file.path), unresolved };
}
