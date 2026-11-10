import { realpathSync } from "node:fs";
import { Effect } from "effect";
import { graph as buildGraph } from "#adapters/imports/graph.ts";
import { analysisFailure } from "#imports/analysisFailure.ts";
import type { RuleInputs } from "#rule.ts";

export const graph = Effect.fn("ImportCompiler.graph")((inputs: RuleInputs) =>
	Effect.try({ catch: (cause) => analysisFailure(inputs.root, cause), try: () => buildGraph(inputs, realpathSync(inputs.root)) }),
);
