import { relative } from "node:path";
import { Effect } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import type { ImportAnalysisFailure } from "#adapters/ImportAnalysisFailure.ts";
import { ImportCompiler } from "#adapters/import-compiler/service.ts";
import type { Endpoint } from "#imports/Endpoint.ts";
import type { ImportKind } from "#imports/extract.ts";
import { type WorkspacePackage, workspacePackages } from "#imports/workspace.ts";
import { posix } from "#inventory/ignoreScope.ts";
import { linesOf } from "#inventory/linesOf.ts";
import { ignoredAmong } from "#inventory/trackedPaths.ts";
import type { Findings, RuleInputs, SourceFile } from "#rule.ts";

export interface ImportEdge {
	readonly from: string;
	readonly kind: ImportKind;
	readonly line: number;
	readonly specifier: string;
	readonly to: Endpoint;
	readonly type: boolean;
}

export type UnresolvedImport = Omit<ImportEdge, "to"> & { readonly missing: string | undefined };

export interface ImportGraph {
	readonly configFindings: Findings;
	readonly edges: readonly ImportEdge[];
	// Imports of the modules git ignores that the sources reach, such as generated output: rules follow them but never report them.
	readonly ignoredEdges: readonly ImportEdge[];
	readonly ignoredModules: readonly string[];
	readonly modules: readonly string[];
	readonly packages: readonly WorkspacePackage[];
	readonly unresolved: readonly UnresolvedImport[];
}

const MODULE = /\.[cm]?[jt]sx?$/u;

const NODE_MODULES = /(?:^|\/)node_modules\//u;

function unlisted(listed: ReadonlySet<string>, edges: readonly ImportEdge[]): readonly string[] {
	const paths = edges.flatMap((edge) => (edge.to.kind === "file" ? [edge.to.path] : []));
	return [...new Set(paths)].filter((path) => !listed.has(path) && MODULE.test(path) && !NODE_MODULES.test(path) && !path.startsWith("../"));
}

const ignoredReach = Effect.fn("Imports.ignoredReach")(function* (
	inputs: RuleInputs,
	edges: readonly ImportEdge[],
	follow: (files: readonly SourceFile[]) => Effect.Effect<readonly ImportEdge[], ImportAnalysisFailure>,
) {
	const listed = new Set(inputs.files);
	const modules: string[] = [];
	const followed: ImportEdge[] = [];
	for (let frontier = unlisted(listed, edges); frontier.length > 0; frontier = unlisted(listed, followed)) {
		const ignored = (yield* ignoredAmong(inputs.root, frontier)).map((path) => posix(relative(inputs.root, path)));
		for (const path of frontier) {
			listed.add(path);
		}
		const files = yield* Effect.forEach(ignored, (path) =>
			Effect.map(inputs.readText(path), (text) => (text === undefined ? [] : [{ lines: linesOf(text), path, text }])),
		);
		modules.push(...ignored);
		followed.push(...(yield* follow(files.flat())));
	}
	return { ignoredEdges: followed, ignoredModules: modules };
});

const build = Effect.fn("Imports.build")(function* (inputs: RuleInputs) {
	const compiler = yield* ImportCompiler;
	const { follow, ...walked } = yield* compiler.graph(inputs);
	if (walked.modules.length === 0) {
		return yield* Effect.die(
			new Error(
				"the import graph covers no modules: the sources hold no TypeScript or JavaScript module. Point `sources` at the TypeScript or JavaScript code.",
			),
		);
	}
	return { ...walked, ...(yield* ignoredReach(inputs, walked.edges, follow)), packages: yield* workspacePackages(inputs) };
});

type Graph = ReturnType<typeof build>;
const graphs = new WeakMap<readonly SourceFile[], Effect.Effect<ImportGraph, Effect.Error<Graph>, ChildProcessSpawner.ChildProcessSpawner>>();

// Import rules run on one scan, so they share the graph built from its sources.
export const importGraph = Effect.fn("Imports.importGraph")(function* (inputs: RuleInputs) {
	const known = graphs.get(inputs.sources);
	if (known !== undefined) {
		return yield* known;
	}
	const graph = yield* Effect.cached(build(inputs).pipe(Effect.provide(ImportCompiler.layer)));
	graphs.set(inputs.sources, graph);
	return yield* graph;
});

export const ignoredModules = Effect.fn("Imports.ignoredModules")(function* (inputs: RuleInputs) {
	return inputs.sources.some((file) => MODULE.test(file.path)) ? (yield* importGraph(inputs)).ignoredModules : [];
});
