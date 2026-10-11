import ts from "typescript";
import { decisionFlow } from "./decisionFlow.ts";
import { decisionRoots } from "./decisionRoots.ts";
import { decisionSymbol } from "./decisionSymbol.ts";

export function decisionGraph(checker: ts.TypeChecker, trees: readonly ts.SourceFile[]) {
	const production = new Set(trees);
	const visited = new Set<ts.Node>();
	function references(node: ts.Node) {
		if (!ts.isIdentifier(node) || node.parent === undefined || ts.isTypeNode(node.parent)) {
			return [];
		}
		return (decisionSymbol(checker, node)?.declarations ?? []).filter(
			(declaration) =>
				production.has(declaration.getSourceFile())
				&& (ts.isVariableDeclaration(declaration) || ts.isFunctionDeclaration(declaration) || ts.isBindingElement(declaration)),
		);
	}
	function visit(node: ts.Node) {
		if (visited.has(node)) {
			return;
		}
		visited.add(node);
		for (const declaration of references(node)) {
			visit(declaration);
		}
		for (const child of decisionFlow(node)) {
			visit(child);
		}
	}
	for (const root of decisionRoots(trees)) {
		visit(root);
	}
	return visited;
}
