import ts from "typescript";
import type { Syntax } from "./syntax.ts";

function importedFrom(node: ts.Node, module: string): boolean {
	for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
		if (ts.isImportDeclaration(current)) {
			return !current.importClause?.isTypeOnly && ts.isStringLiteral(current.moduleSpecifier) && current.moduleSpecifier.text === module;
		}
	}
	return false;
}

function effectNamespace(node: ts.Expression, checker: ts.TypeChecker): boolean {
	if (!ts.isIdentifier(node)) {
		return false;
	}
	return (checker.getSymbolAtLocation(node)?.declarations ?? []).some(
		(declaration) =>
			(ts.isImportSpecifier(declaration)
				&& !declaration.isTypeOnly
				&& (declaration.propertyName ?? declaration.name).text === "Effect"
				&& importedFrom(declaration, "effect"))
			|| (ts.isNamespaceImport(declaration) && importedFrom(declaration, "effect/Effect")),
	);
}

export function nativeEffectCall(node: ts.Node, name: string, { checker }: Syntax): node is ts.CallExpression {
	if (!ts.isCallExpression(node)) {
		return false;
	}
	const callee = node.expression;
	if (ts.isPropertyAccessExpression(callee)) {
		return callee.name.text === name && effectNamespace(callee.expression, checker);
	}
	return (
		ts.isIdentifier(callee)
		&& (checker.getSymbolAtLocation(callee)?.declarations ?? []).some(
			(declaration) =>
				ts.isImportSpecifier(declaration)
				&& !declaration.isTypeOnly
				&& (declaration.propertyName ?? declaration.name).text === name
				&& importedFrom(declaration, "effect/Effect"),
		)
	);
}
