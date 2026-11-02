import { Effect } from "effect";
import { importGraph } from "#imports/graph.ts";
import type { RuleInputs } from "#rule.ts";
import { compilePolicy } from "./compilePolicy.ts";
import { discoverFences } from "./discover.ts";
import type { Fence } from "./model.ts";

export const checkFences = Effect.fn("Imports.checkFences")(function* (inputs: RuleInputs, configured: readonly Fence[]) {
	const graph = yield* importGraph(inputs);
	const fences = [...configured, ...(yield* Effect.promise(() => discoverFences(inputs, graph.packages)))];
	const policy = compilePolicy(fences, { files: inputs.files, packages: graph.packages });
	return policy.flatMap((compiled) => compiled.evaluate(graph));
});
