import { Effect } from "effect";
import ts from "typescript";
import { engineEscapes } from "#adapters/engineEscapes.ts";
import { importGraph } from "#imports/graph.ts";
import { packageOf } from "#imports/workspace.ts";
import { testName } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";
import { storyOrigins } from "#rules/stories/origins.ts";
import { storyPrerequisites } from "#rules/stories/prerequisites.ts";
import { nodesWhere, unwrapped } from "#rules/stories/syntax.ts";
import { storyUsesInputs } from "#rules/stories/usesInputs.ts";

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
	check: Effect.fn("Stories.check")(function* (inputs) {
		const graph = yield* importGraph(inputs);
		const exempt = yield* Effect.promise(() => storyPrerequisites(inputs, graph.packages));
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
			const stories = nodesWhere(source, (node) => ts.isCallExpression(node) && origins.origin(node.expression) === "story").filter(
				ts.isCallExpression,
			);
			return stories.flatMap((story) => {
				const body = story.arguments[2];
				const checked = body === undefined ? { drivesSubject: false, escapes: [] } : engineEscapes(body, origins.checker, file.path);
				if (checked.escapes.length > 0) {
					return checked.escapes.map(({ node, reason }) => ({
						file: file.path,
						line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
						message: `${reason} in a spec body. Move engine access and wiring into the story kit's verbs or traits in test-support/. Keep expectations in the spec. Constructor tests may call the constructor in their colocated module; native SQL transaction blocks may wrap kit verbs. See https://github.com/ShivaeDev/platform/tree/main/packages/quality#story-tests.`,
					}));
				}
				if (checked.drivesSubject || !ignoresEngine(story, origins.checker)) {
					return [];
				}
				return [
					{
						file: file.path,
						line: source.getLineAndCharacterOfPosition(story.getStart(source)).line + 1,
						message: `Declares a story without traits whose body never references its verbs, its story or its test context. Drive the engine through one of the kit's verbs or traits. If the code under test is pure, move the test to ${name.stem}.unit.${name.kind}${name.extension}, which reaches no engine and mocks nothing. See https://github.com/ShivaeDev/platform/tree/main/packages/quality#story-tests.`,
					},
				];
			});
		});
	}),
	description:
		"Story bodies use their kit instead of raw services, story.engine or production wiring; constructor subjects and native transaction blocks remain explicit.",
	id: "tests/story-engine",
});
