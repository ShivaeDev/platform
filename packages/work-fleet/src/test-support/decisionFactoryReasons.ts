import ts from "typescript";
import { decisionSymbol } from "./decisionSymbol.ts";

function reasonArgument(node: ts.Node) {
	if (!ts.isCallExpression(node)) {
		return undefined;
	}
	const name = node.expression.getText();
	if (name === "waitingDecision") {
		return node.arguments[0];
	}
	return ["decision", "state.decision"].includes(name) ? node.arguments[1] : undefined;
}
function finalReason(declaration: ts.Declaration) {
	const returned = ts.isFunctionDeclaration(declaration) ? declaration.body?.statements.at(-1) : undefined;
	return returned !== undefined && ts.isReturnStatement(returned) && returned.expression !== undefined && ts.isStringLiteralLike(returned.expression)
		? returned.expression.text
		: undefined;
}
export function decisionFactoryReasons(checker: ts.TypeChecker, trees: readonly ts.SourceFile[]) {
	const reasons: string[] = [];
	function visit(node: ts.Node) {
		const argument = reasonArgument(node);
		if (argument !== undefined && ts.isCallExpression(argument)) {
			for (const declaration of decisionSymbol(checker, argument.expression)?.declarations ?? []) {
				const reason = finalReason(declaration);
				if (reason !== undefined) {
					reasons.push(reason);
				}
			}
		}
		ts.forEachChild(node, visit);
	}
	for (const tree of trees) {
		visit(tree);
	}
	return reasons;
}
