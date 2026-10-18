import ts from "typescript";
import { defineRule } from "#rule.ts";
import { isSpec, memberName, nodesWhere, numericValue, syntaxFindings } from "./syntax.ts";

const MESSAGE =
	"Passes a numeric literal to toBe or toHaveLength. Assert the observed items, or give the expected value a domain name before asserting it.";

function numericAssertion(node: ts.Node): boolean {
	return (
		ts.isCallExpression(node)
		&& ["toBe", "toHaveLength"].includes(memberName(node.expression) ?? "")
		&& node.arguments.some((argument) => numericValue(argument) !== undefined)
	);
}

export const namedValues = defineRule({
	check: ({ sources }) =>
		sources.filter((file) => isSpec(file.path)).flatMap((file) => syntaxFindings(file, (source) => nodesWhere(source, numericAssertion), MESSAGE)),
	description: "Stories assert observed items or named values instead of bare counts and numbers.",
	id: "tests/named-values",
});
