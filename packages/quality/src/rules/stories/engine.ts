import ts from "typescript";
import { importGraph } from "#imports/graph.ts";
import { packageOf } from "#imports/workspace.ts";
import { testName } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";
import { storyOrigins } from "./origins.ts";
import { storyPrerequisites } from "./prerequisites.ts";
import { nodesWhere, unwrapped } from "./syntax.ts";
import { storyUsesInputs } from "./usesInputs.ts";

function ignoresEngine(call: ts.CallExpression, checker: ts.TypeChecker): boolean {
	const traits = call.arguments[1];
	const given = traits === undefined ? undefined : unwrapped(traits);
	const body = call.arguments[2];
	return (
		given !== undefined
		&& ts.isArrayLiteralExpression(given)
		&& given.elements.length === 0
		&& (body === undefined || storyUsesInputs(body, checker) === false)
	);
}

export const storyEngine = defineRule({
	check: async (inputs) => {
		const graph = await importGraph(inputs);
		const exempt = await storyPrerequisites(inputs, graph.packages);
		const origins = storyOrigins(inputs, graph);
		return inputs.sources.flatMap((file) => {
			const name = testName(file.path);
			const owner = packageOf(graph.packages, file.path);
			if (
				name === undefined
				|| name.modifiers.some((modifier) => modifier === "unit" || modifier === "typecheck")
				|| exempt.has(owner?.directory ?? "")
			) {
				return [];
			}
			const source = origins.source(file.path);
			if (source === undefined) {
				return [];
			}
			const stories = nodesWhere(
				source,
				(node) => ts.isCallExpression(node) && origins.origin(node.expression) === "story" && ignoresEngine(node, origins.checker),
			);
			return stories.map((story) => ({
				file: file.path,
				line: source.getLineAndCharacterOfPosition(story.getStart(source)).line + 1,
				message: `Declares a story without traits whose body never references its verbs, its story or its test context. Drive the engine through one of the kit's verbs or traits. If the code under test is pure, move the test to ${name.stem}.unit.${name.kind}${name.extension}, which reaches no engine and mocks nothing. See https://github.com/ShivaeDev/platform/tree/main/packages/quality#story-tests.`,
			}));
		});
	},
	description:
		"A story without traits references its kit's verbs, its story or its test context; pure tests belong in .unit files that reach no engine and mock nothing.",
	id: "tests/story-engine",
});
