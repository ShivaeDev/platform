import ts from "typescript";
import { defineRule } from "#rule.ts";
import { isSpec, memberName, nodesWhere, numericValue, syntaxFindings, unwrapped } from "./syntax.ts";

const MESSAGE =
	"Passes a numeric literal to toBe or toHaveLength. Assert the observed items, or give the expected value a domain name before asserting it.";

function codeSubject(expression: ts.Expression): boolean {
	const value = unwrapped(expression);
	if (!(ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value))) {
		return false;
	}
	let root = unwrapped(value.expression);
	while ((ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root)) && memberName(root) === "not") {
		root = unwrapped(root.expression);
	}
	if (!ts.isCallExpression(root)) {
		return false;
	}
	const callee = unwrapped(root.expression);
	const receiver = ts.isPropertyAccessExpression(callee) ? unwrapped(callee.expression) : callee;
	const expect = ts.isIdentifier(receiver) && receiver.text === "expect" && (receiver === callee || memberName(callee) === "soft");
	const argument = root.arguments[0];
	if (!expect || argument === undefined) {
		return false;
	}
	const subject = unwrapped(argument);
	return ["status", "code", "exitCode"].includes(ts.isIdentifier(subject) ? subject.text : (memberName(subject) ?? ""));
}

function numericAssertion(node: ts.Node): boolean {
	return (
		ts.isCallExpression(node)
		&& ["toBe", "toHaveLength"].includes(memberName(node.expression) ?? "")
		&& !codeSubject(node.expression)
		&& node.arguments.some((argument) => {
			const value = numericValue(argument);
			return value !== undefined && value !== 0;
		})
	);
}

export const namedValues = defineRule({
	check: ({ sources }) =>
		sources.filter((file) => isSpec(file.path)).flatMap((file) => syntaxFindings(file, (source) => nodesWhere(source, numericAssertion), MESSAGE)),
	description: "Stories assert observed items or named values instead of bare counts and numbers.",
	id: "tests/named-values",
});
