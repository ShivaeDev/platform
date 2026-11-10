import { realpathSync } from "node:fs";
import { Effect } from "effect";
import { analysisFailure } from "#adapters/imports/analysisFailure.ts";
import { graph as buildGraph } from "#adapters/imports/graph.ts";
import type { RuleInputs, SourceFile } from "#rule.ts";

export const graph = Effect.fn("ImportCompiler.graph")((inputs: RuleInputs) =>
	Effect.try({ catch: (cause) => analysisFailure(inputs.root, cause), try: () => buildGraph(inputs, realpathSync(inputs.root)) }).pipe(
		Effect.map(({ follow, ...walked }) => ({
			...walked,
			follow: (files: readonly SourceFile[]) => Effect.try({ catch: (cause) => analysisFailure(inputs.root, cause), try: () => follow(files) }),
		})),
	),
);
