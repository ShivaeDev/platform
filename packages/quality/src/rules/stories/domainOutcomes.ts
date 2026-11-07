import { Effect } from "effect";
import ts from "typescript";
import { importGraph } from "#imports/graph.ts";
import { defineRule } from "#rule.ts";
import { internalValue, shapeModule } from "#rules/stories/adapters/outcomeShapes.ts";
import { importBindings } from "#rules/stories/importBindings.ts";
import { storyOrigins } from "#rules/stories/origins.ts";
import { storySources } from "#rules/stories/sources.ts";
import { findingAt, memberName, nodesWhere, unwrapped } from "#rules/stories/syntax.ts";

const MESSAGE =
	'Uses an Exit, Cause or Result value or reads an internal outcome tag in a story. Have the kit\'s verb or readout return the outcome in the domain\'s words, such as "unauthorized" or "rolled back", and expect that; build failing inputs in a kit trait.';

const OUTCOME_TAGS = new Set(["Failure", "Success"]);

function outcomeTag(node: ts.PropertyAssignment): boolean {
	const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : undefined;
	const value = unwrapped(node.initializer);
	return name === "_tag" && ts.isStringLiteralLike(value) && OUTCOME_TAGS.has(value.text);
}

function shapeReads(source: ts.SourceFile, checker: ts.TypeChecker): readonly ts.Node[] {
	const bindings = importBindings(source);
	return nodesWhere(
		source,
		(node) =>
			((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
				&& (shapeModule(node.expression, bindings) || (memberName(node) === "_tag" && internalValue(node.expression, bindings, checker))))
			|| (ts.isBindingElement(node)
				&& (node.propertyName ?? node.name).getText(source) === "_tag"
				&& ts.isVariableDeclaration(node.parent.parent)
				&& node.parent.parent.initializer !== undefined
				&& internalValue(node.parent.parent.initializer, bindings, checker))
			|| (ts.isPropertyAssignment(node) && outcomeTag(node)),
	);
}

export const domainOutcomes = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const stories = yield* storySources(inputs);
			const origins = storyOrigins(inputs, yield* importGraph(inputs));
			const checker = origins.checker;
			return stories.flatMap((file) => {
				const source = origins.source(file.path);
				return source === undefined ? [] : shapeReads(source, checker).map((node) => ({ ...findingAt(source, node, MESSAGE), file: file.path }));
			});
		}),
	description: "Story verbs and readouts return outcomes in the domain's words, not Exit, Cause or Result shapes or their internal tag reads.",
	id: "tests/domain-outcomes",
});
