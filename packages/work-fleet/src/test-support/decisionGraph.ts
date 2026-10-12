import ts from "typescript";
import { decisionFlow } from "./decisionFlow.ts";
import { decisionRoots } from "./decisionRoots.ts";
import { decisionSymbol } from "./decisionSymbol.ts";

function initializationField(binding: ts.BindingElement) {
	const parameter = binding.parent.parent;
	if (!(ts.isParameter(parameter) && ts.isArrowFunction(parameter.parent))) {
		return [];
	}
	const methods = parameter.parent.parent;
	if (!ts.isPropertyAssignment(methods) || methods.name.getText() !== "methods" || !ts.isObjectLiteralExpression(methods.parent)) {
		return [];
	}
	const initialize = methods.parent.properties.find((property) => ts.isPropertyAssignment(property) && property.name.getText() === "initialize");
	if (initialize === undefined || !ts.isPropertyAssignment(initialize) || !ts.isCallExpression(initialize.initializer)) {
		return [];
	}
	const generator = initialize.initializer.arguments[0];
	const returned = generator !== undefined && ts.isFunctionExpression(generator) ? generator.body.statements.at(-1) : undefined;
	return returned !== undefined
		&& ts.isReturnStatement(returned)
		&& returned.expression !== undefined
		&& ts.isObjectLiteralExpression(returned.expression)
		? returned.expression.properties.filter((property) => property.name?.getText() === binding.name.getText())
		: [];
}

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
		if (ts.isBindingElement(node)) {
			for (const field of initializationField(node)) {
				visit(field);
			}
		}
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
