import { Effect } from "effect";
import { ImportCompiler } from "#adapters/import-compiler/service.ts";
import type { Endpoint } from "#imports/Endpoint.ts";
import type { ImportKind } from "#imports/extract.ts";
import { type WorkspacePackage, workspacePackages } from "#imports/workspace.ts";
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
	readonly modules: readonly string[];
	readonly packages: readonly WorkspacePackage[];
	readonly unresolved: readonly UnresolvedImport[];
}

const build = Effect.fn("Imports.build")(function* (inputs: RuleInputs) {
	const compiler = yield* ImportCompiler;
	const walked = yield* compiler.graph(inputs);
	if (walked.modules.length === 0) {
		return yield* Effect.die(
			new Error(
				"the import graph covers no modules: the sources hold no TypeScript or JavaScript module. Point `sources` at the TypeScript or JavaScript code.",
			),
		);
	}
	return { ...walked, packages: yield* workspacePackages(inputs) };
});

type Graph = ReturnType<typeof build>;
const graphs = new WeakMap<readonly SourceFile[], Effect.Effect<ImportGraph, Effect.Error<Graph>>>();

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
