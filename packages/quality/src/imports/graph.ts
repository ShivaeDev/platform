import { realpathSync } from "node:fs";
import { join } from "node:path";
import type { RuleInputs, SourceFile } from "../rule.ts";
import { parse } from "../rules/syntax.ts";
import { ambientModules } from "./ambient.ts";
import { importsOf } from "./extract.ts";
import { generatedTarget } from "./generated.ts";
import { projectsFor } from "./projects.ts";
import { type Endpoint, resolveImport } from "./resolve.ts";
import { type WorkspacePackage, workspacePackages } from "./workspace.ts";

export interface ImportEdge {
	readonly from: string;
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
		return syntax === undefined ? [] : [{ file, syntax }];
	});
	const ambient = ambientModules(parsed.map(({ syntax }) => syntax));
	const edges: ImportEdge[] = [];
	const unresolved: UnresolvedImport[] = [];
	for (const { file, syntax } of parsed) {
		const from = join(root, file.path);
		const project = projectOf(from);
		for (const request of importsOf(syntax, DECLARATION.test(file.path))) {
			const to = resolveImport(root, ambient, request.specifier, from, project);
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
	const generated = await Promise.all(
		walked.unresolved.map(async (request) => ({ request, target: await generatedTarget(inputs, request.from, request.specifier) })),
	);
	const generatedEdges = generated.flatMap(({ request, target }): readonly ImportEdge[] =>
		target === undefined ? [] : [{ ...request, to: { kind: "file", path: target } }],
	);
	return {
		edges: [...walked.edges, ...generatedEdges],
		modules: walked.modules,
		packages: await workspacePackages(inputs),
		unresolved: generated.flatMap(({ request, target }) => (target === undefined ? [request] : [])),
	};
}

const graphs = new WeakMap<readonly SourceFile[], Promise<ImportGraph>>();

// The three imports rules run on one scan, so they share the graph built from its sources.
export function importGraph(inputs: RuleInputs): Promise<ImportGraph> {
	const known = graphs.get(inputs.sources) ?? build(inputs);
	graphs.set(inputs.sources, known);
	return known;
}
