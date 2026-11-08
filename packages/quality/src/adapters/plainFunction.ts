import ts from "typescript";
import { wrapsEffectFunction } from "#adapters/frameworkCallback.ts";

function effectBody(checker: ts.TypeChecker, node: ts.Node): boolean {
	if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) && node.asteriskToken !== undefined) {
		return true;
	}
	return (
		(ts.isArrowFunction(node) || ts.isFunctionExpression(node))
		&& ts.isCallExpression(node.parent)
		&& wrapsEffectFunction(checker, node.parent.expression)
	);
}

export function plainFunction(checker: ts.TypeChecker, fn: ts.Node): boolean {
	for (let node: ts.Node | undefined = fn; node !== undefined; node = node.parent) {
		if (effectBody(checker, node)) {
			return false;
		}
	}
	return true;
}
