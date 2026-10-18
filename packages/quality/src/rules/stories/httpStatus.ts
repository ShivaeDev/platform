import { Effect, Schema } from "effect";
import ts from "typescript";
import { defineRule } from "#rule.ts";
import { matchesAny } from "./matchesAny.ts";
import { memberName, nodesWhere, numericValue, syntaxFindings, unwrapped } from "./syntax.ts";

const MESSAGE =
	"Branches on an HTTP error status outside the HTTP edge. Handle the typed domain error here and translate it to an HTTP status in the configured edge module.";

const HttpStatusOptions = Schema.Struct({
	edge: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

const COMPARISONS = new Set([
	ts.SyntaxKind.EqualsEqualsToken,
	ts.SyntaxKind.EqualsEqualsEqualsToken,
	ts.SyntaxKind.ExclamationEqualsToken,
	ts.SyntaxKind.ExclamationEqualsEqualsToken,
	ts.SyntaxKind.LessThanToken,
	ts.SyntaxKind.LessThanEqualsToken,
	ts.SyntaxKind.GreaterThanToken,
	ts.SyntaxKind.GreaterThanEqualsToken,
]);

function isErrorStatus(node: ts.Expression): boolean {
	const number = numericValue(node);
	return number !== undefined && number >= 400 && number <= 599;
}

function statusBranch(node: ts.Node): boolean {
	if (ts.isBinaryExpression(node) && COMPARISONS.has(node.operatorToken.kind)) {
		return (memberName(node.left) === "status" && isErrorStatus(node.right)) || (memberName(node.right) === "status" && isErrorStatus(node.left));
	}
	if (ts.isCaseClause(node) && isErrorStatus(node.expression) && ts.isCaseBlock(node.parent) && ts.isSwitchStatement(node.parent.parent)) {
		return memberName(node.parent.parent.expression) === "status";
	}
	if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "includes") {
		const receiver = unwrapped(node.expression.expression);
		return (
			ts.isArrayLiteralExpression(receiver)
			&& receiver.elements.some(isErrorStatus)
			&& node.arguments.some((argument) => memberName(argument) === "status")
		);
	}
	return false;
}

export const httpStatus = defineRule({
	check: ({ sources, options }) =>
		sources
			.filter((file) => !matchesAny(file.path, options.edge))
			.flatMap((file) => syntaxFindings(file, (source) => nodesWhere(source, statusBranch), MESSAGE)),
	description: "HTTP status numbers belong at the repository's HTTP edge; domain code handles typed errors.",
	id: "boundaries/http-status",
	options: Schema.toStandardSchemaV1(HttpStatusOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
