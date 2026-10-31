import { Effect } from "effect";
import ts from "typescript";
import { importGraph } from "#imports/graph.ts";
import { packageOf } from "#imports/workspace.ts";
import { isTestSupport, testName } from "#naming/testName.ts";
import type { RuleInputs } from "#rule.ts";
import { storyOrigins } from "./origins.ts";
import { storyPrerequisites } from "./prerequisites.ts";

export const storySources = Effect.fn("Stories.storySources")(function* (inputs: RuleInputs) {
	const graph = yield* Effect.promise(() => importGraph(inputs));
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
