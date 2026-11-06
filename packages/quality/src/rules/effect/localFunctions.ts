import ts from "typescript";
import { frameworkCallback } from "#rules/effect/frameworkCallback.ts";

export function localFunctions(sources: readonly ts.SourceFile[], checker: ts.TypeChecker, parameters: (signature: ts.Signature) => void): void {
	const local = new Set(sources);
	function visit(node: ts.Node): void {
		if (
			(ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))
			&& node.parameters.length > 0
			&& !frameworkCallback(checker, node, local)
		) {
			const signature = checker.getSignatureFromDeclaration(node);
			if (signature !== undefined) {
				parameters(signature);
			}
		}
		ts.forEachChild(node, visit);
	}
	for (const source of sources) {
		visit(source);
	}
}
