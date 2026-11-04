import { Effect } from "effect";
import ts from "typescript";
import { outgoing } from "#imports/fences/reach.ts";
import { importGraph } from "#imports/graph.ts";
import { packageOf } from "#imports/workspace.ts";
import { isTestSupport, testName } from "#naming/testName.ts";
import type { RuleInputs } from "#rule.ts";
import { storyOrigins } from "./origins.ts";
import { storyPrerequisites } from "./prerequisites.ts";

export const storySources = Effect.fn("Stories.storySources")(function* (inputs: RuleInputs) {
	const graph = yield* importGraph(inputs);
	const packages = graph.packages;
	const origins = storyOrigins(inputs, graph);
	const exempt = yield* Effect.promise(() => storyPrerequisites(inputs, packages));
	function hasStory(node: ts.Node): boolean {
		return (ts.isCallExpression(node) && origins.origin(node.expression) === "story") || ts.forEachChild(node, hasStory) === true;
	}
	return inputs.sources.filter((file) => {
		const modifiers = testName(file.path)?.modifiers;
		if (
			modifiers === undefined
			|| isTestSupport(file.path)
			|| modifiers.includes("typecheck")
			|| modifiers.includes("unit")
			|| exempt.has(packageOf(packages, file.path)?.directory ?? "")
		) {
			return false;
		}
		const source = origins.source(file.path);
		return source !== undefined && hasStory(source);
	});
});

export const storyWaitSources = Effect.fn("Stories.storyWaitSources")(function* (inputs: RuleInputs) {
	const stories = yield* storySources(inputs);
	const graph = yield* importGraph(inputs);
	const edges = outgoing(graph.edges.filter((edge) => edge.kind === "import" && !edge.type));
	const reached = new Set(stories.map((file) => file.path));
	const queue = [...reached];
	for (const file of queue) {
		for (const edge of edges.get(file) ?? []) {
			if (edge.to.kind === "file" && !reached.has(edge.to.path)) {
				reached.add(edge.to.path);
				queue.push(edge.to.path);
			}
		}
	}
	return inputs.sources.filter((file) => stories.includes(file) || (isTestSupport(file.path) && reached.has(file.path)));
});
