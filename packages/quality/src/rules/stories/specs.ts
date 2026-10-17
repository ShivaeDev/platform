import ts from "typescript";
import { importGraph } from "#imports/graph.ts";
import { packageOf } from "#imports/workspace.ts";
import { testName } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";
import { storyOrigins } from "./origins.ts";
import { storyPrerequisites } from "./prerequisites.ts";

function namesTest(node: ts.Expression): boolean {
	if (ts.isIdentifier(node)) {
		return node.text === "it" || node.text === "test";
	}
	if (ts.isPropertyAccessExpression(node)) {
		return node.name.text === "it" || namesTest(node.expression);
	}
	return ts.isCallExpression(node) && namesTest(node.expression);
}

function testShaped(call: ts.CallExpression): boolean {
	const title = call.arguments[0];
	return (
		title !== undefined
		&& (ts.isStringLiteralLike(title) || ts.isTemplateExpression(title))
		&& call.arguments.slice(1).some((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))
	);
}

export const storySpecs = defineRule({
	check: async (inputs) => {
		const graph = await importGraph(inputs);
		const exempt = await storyPrerequisites(inputs, graph.packages);
		const origins = storyOrigins(inputs, graph);
		return inputs.sources.flatMap((file) => {
			const name = testName(file.path);
			const owner = packageOf(graph.packages, file.path);
			if (name === undefined || name.modifiers.includes("typecheck") || exempt.has(owner?.directory ?? "")) {
				return [];
			}
			const source = origins.source(file.path);
			let plain: ts.CallExpression | undefined;
			let registration: ts.CallExpression | undefined;
			let story = false;
			function visit(node: ts.Node): void {
				if (ts.isCallExpression(node)) {
					const origin = origins.origin(node.expression);
					if (testShaped(node)) {
						registration ??= node;
					}
					story ||= origin === "story";
					if (origin !== "story" && (origin === "plain" || namesTest(node.expression))) {
						plain ??= node;
					}
				}
				ts.forEachChild(node, visit);
			}
			if (source !== undefined) {
				visit(source);
			}
			const uncovered = plain ?? (story ? undefined : registration);
			if (source === undefined || uncovered === undefined) {
				return [];
			}
			return [
				{
					file: file.path,
					line: source.getLineAndCharacterOfPosition(uncovered.getStart(source)).line + 1,
					message:
						"Declares tests without a test-story story kit. Build the package's kit with storyKit from @shivaedev/test-story/storyKit.ts in src/test-support, and declare every test through the kit's it. See https://github.com/ShivaeDev/platform/tree/main/packages/quality#story-tests.",
				},
			];
		});
	},
	description:
		"Every package tests its real engine through its own test-story kit. Typecheck tests and test-story's workspace prerequisites are exempt.",
	id: "tests/story-specs",
});
