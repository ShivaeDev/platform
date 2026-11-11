import { Effect } from "effect";
import { compilePolicy } from "#imports/fences/compilePolicy.ts";
import { discoverFences } from "#imports/fences/discover.ts";
import type { Fence } from "#imports/fences/model.ts";
import { followedEdges, generatedFolders } from "#imports/generatedFolders.ts";
import { importGraph } from "#imports/graph.ts";
import type { RuleInputs } from "#rule.ts";

export const checkFences = Effect.fn("Imports.checkFences")(function* (inputs: RuleInputs, configured: readonly Fence[]) {
	const graph = yield* importGraph(inputs);
	const fences = [...configured, ...(yield* discoverFences(inputs, graph.packages))];
	const policy = yield* Effect.fromResult(compilePolicy(fences, { files: inputs.files, packages: graph.packages }));
	const followed = { ...graph, ignoredEdges: followedEdges(generatedFolders(graph.packages), graph.ignoredEdges) };
	return policy.flatMap((compiled) => compiled.evaluate(followed));
});
