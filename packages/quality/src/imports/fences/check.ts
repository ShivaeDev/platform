import { importGraph } from "#imports/graph.ts";
import type { Findings, RuleInputs } from "#rule.ts";
import { compilePolicy } from "./compilePolicy.ts";
import { discoverFences } from "./discover.ts";
import type { Fence } from "./model.ts";

export async function checkFences(inputs: RuleInputs, configured: readonly Fence[]): Promise<Findings> {
	const graph = await importGraph(inputs);
	const fences = [...configured, ...(await discoverFences(inputs, graph.packages))];
	const policy = compilePolicy(fences, { files: inputs.files, packages: graph.packages });
	return policy.flatMap((compiled) => compiled.evaluate(graph));
}
