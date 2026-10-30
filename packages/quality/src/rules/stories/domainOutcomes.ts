import { Effect } from "effect";
import ts from "typescript";
import { defineRule } from "#rule.ts";
import { bindsModule, importBindings } from "./importBindings.ts";
import { storySpecSources } from "./specSources.ts";
import { memberName, nodesWhere, syntaxFindings, unwrapped } from "./syntax.ts";

const MESSAGE =
	'Uses an Exit, Cause or Result value or reads a _tag in a spec. Have the kit\'s verb or readout return the outcome in the domain\'s words, such as "unauthorized" or "rolled back", and expect that; build failing inputs in a kit trait.';

const SHAPES = ["Exit", "Cause", "Result"];
const OUTCOME_TAGS = new Set(["Failure", "Success"]);

function shapeModule(source: ts.SourceFile): (node: ts.Expression) => boolean {
	const bindings = importBindings(source);
	return (node) => {
		const value = unwrapped(node);
		return ts.isIdentifier(value) && SHAPES.some((shape) => bindsModule(bindings.get(value.text), shape, ["effect"]));
	};
}

function outcomeTag(node: ts.PropertyAssignment): boolean {
	const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : undefined;
	const value = unwrapped(node.initializer);
	return name === "_tag" && ts.isStringLiteralLike(value) && OUTCOME_TAGS.has(value.text);
}

function shapeReads(source: ts.SourceFile): readonly ts.Node[] {
	const fromShapeModule = shapeModule(source);
	return nodesWhere(
		source,
		(node) =>
			((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
				&& (memberName(node) === "_tag" || fromShapeModule(node.expression)))
			|| (ts.isBindingElement(node) && (node.propertyName ?? node.name).getText(source) === "_tag")
			|| (ts.isPropertyAssignment(node) && outcomeTag(node)),
	);
}

export const domainOutcomes = defineRule({
	check: (inputs) => Effect.map(storySpecSources(inputs), (specs) => specs.flatMap((file) => syntaxFindings(file, shapeReads, MESSAGE))),
	description: "Story verbs and readouts return outcomes in the domain's words, not Exit, Cause or Result shapes or _tag reads.",
	id: "tests/domain-outcomes",
});
