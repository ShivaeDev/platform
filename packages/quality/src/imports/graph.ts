import { realpathSync } from "node:fs";
import { join } from "node:path";
import type { RuleInputs, SourceFile } from "../rule.ts";
import { parse } from "../rules/syntax.ts";
import { ambientModules } from "./ambient.ts";
import { type ImportKind, importsOf } from "./extract.ts";
import { projectsFor } from "./projects.ts";
import { type Endpoint, resolveImport } from "./resolve.ts";
import { type WorkspacePackage, workspacePackages } from "./workspace.ts";

export interface ImportEdge {
	readonly from: string;
	readonly kind: ImportKind;
	readonly line: number;
	readonly specifier: string;
	readonly to: Endpoint;
	readonly type: boolean;
}

export type UnresolvedImport = Omit<ImportEdge, "to">;

export interface ImportGraph {
	readonly edges: readonly ImportEdge[];
	readonly modules: readonly string[];
	readonly packages: readonly WorkspacePackage[];
	readonly unresolved: readonly UnresolvedImport[];
}

const DECLARATION = /\.d\.[cm]?ts$/u;

const NO_MODULES =
	"the import graph covers no modules: the sources hold no TypeScript or JavaScript module. Point `sources` at the code, or turn the imports rules off.";

function walk(inputs: RuleInputs, root: string): Pick<ImportGraph, "edges" | "modules" | "unresolved"> {
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
		for (const request of importsOf(syntax, DECLARATION.test(file.path))) {
			const to = resolveImport(root, ambient, request, path, project);
			if (to === undefined) {
				unresolved.push({ ...request, from: file.path });
			} else {
				edges.push({ ...request, from: file.path, to });
			}
		}
	}
	return { edges, modules: parsed.map(({ file }) => file.path), unresolved };
}

async function build(inputs: RuleInputs): Promise<ImportGraph> {
	const walked = walk(inputs, realpathSync(inputs.root));
	if (walked.modules.length === 0) {
		throw new Error(NO_MODULES);
	}
	return { ...walked, packages: await workspacePackages(inputs) };
}

const graphs = new WeakMap<readonly SourceFile[], Promise<ImportGraph>>();

// The three imports rules run on one scan, so they share the graph built from its sources.
export function importGraph(inputs: RuleInputs): Promise<ImportGraph> {
	const known = graphs.get(inputs.sources) ?? build(inputs);
	graphs.set(inputs.sources, known);
	return known;
}
