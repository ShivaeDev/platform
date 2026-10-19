import ts from "typescript";
import { importGraph } from "#imports/graph.ts";
import { packageOf } from "#imports/workspace.ts";
import { testName } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";
import { storyOrigins } from "./origins.ts";
import { storyPrerequisites } from "./prerequisites.ts";
import { unitTests } from "./unitTests.ts";

function namesTest(node: ts.Expression): boolean {
	if (ts.isIdentifier(node)) {
		return node.text === "it" || node.text === "test";
	}
	if (ts.isPropertyAccessExpression(node)) {
		return node.name.text === "it" || namesTest(node.expression);
	}
	return ts.isCallExpression(node) && namesTest(node.expression);
}

type OriginOf = ReturnType<typeof storyOrigins>["origin"];

function callback(node: ts.Node, origin: OriginOf): boolean {
	return (
		ts.isArrowFunction(node)
		|| ts.isFunctionExpression(node)
		|| ((ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) && origin(node) === "function")
	);
}

function testShaped(call: ts.CallExpression, origin: OriginOf): boolean {
	const title = call.arguments[0];
	return (
		title !== undefined
		&& (ts.isStringLiteralLike(title) || ts.isTemplateExpression(title))
		&& call.arguments.slice(1).some((argument) => callback(argument, origin))
	);
}

function declarationScope(node: ts.Node, origin: OriginOf): boolean {
	for (let current = node.parent; current !== undefined; current = current.parent) {
		if (ts.isFunctionLike(current) && (!ts.isCallExpression(current.parent) || origin(current.parent.expression) !== "suite")) {
			return false;
		}
	}
	return true;
}

function uncoveredRegistration(call: ts.CallExpression, originOf: OriginOf): boolean {
	const origin = originOf(call.expression);
	if (origin === "story" || origin === "suite") {
		return false;
	}
	return origin === "plain" || ((namesTest(call.expression) || testShaped(call, originOf)) && declarationScope(call, originOf));
}

export const storySpecs = defineRule({
	check: async (inputs) => {
		const graph = await importGraph(inputs);
		const exempt = await storyPrerequisites(inputs, graph.packages);
		const origins = storyOrigins(inputs, graph);
		const unit = unitTests(graph, inputs.sources);
		return inputs.sources.flatMap((file) => {
			const name = testName(file.path);
			if (name?.modifiers.includes("unit") === true) {
				return unit(file.path);
			}
			const owner = packageOf(graph.packages, file.path);
			if (name === undefined || name.modifiers.includes("typecheck") || exempt.has(owner?.directory ?? "")) {
				return [];
			}
			const source = origins.source(file.path);
			let plain: ts.CallExpression | undefined;
			function visit(node: ts.Node): void {
				if (ts.isCallExpression(node) && uncoveredRegistration(node, origins.origin)) {
					plain ??= node;
				}
				ts.forEachChild(node, visit);
			}
			if (source !== undefined) {
				visit(source);
			}
			if (source === undefined || plain === undefined) {
				return [];
			}
			return [
				{
					file: file.path,
					line: source.getLineAndCharacterOfPosition(plain.getStart(source)).line + 1,
					message: `Declares tests without a test-story story kit. Drive the engine through the package's story kit: build it with storyKit from @shivaedev/test-story/server/storyKit.ts in src/test-support, and declare every test through the kit's it. If the code under test is pure, move the test to ${name.stem}.unit.${name.kind}${name.extension}, which reaches no engine and mocks nothing. See https://github.com/ShivaeDev/platform/tree/main/packages/quality#story-tests.`,
				},
			];
		});
	},
	description:
		"Every package tests its real engine through its own test-story kit, and a plain test lives only in a .unit file that reaches no engine and mocks nothing. Typecheck tests and test-story's workspace prerequisites need no kit.",
	id: "tests/story-specs",
});
