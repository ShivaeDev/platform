import ts from "typescript";
import { unwrapExpression } from "#adapters/serviceAssemblySyntax.ts";
import { boundaryReference } from "#rules/effect/boundaryReference.ts";

export function effectApi(checker: ts.TypeChecker, node: ts.Node, name: string): boolean {
	if (ts.isParenthesizedExpression(node)) {
		return effectApi(checker, node.expression, name);
	}
	if (ts.isPropertyAccessExpression(node) && node.name.text !== name) {
		return false;
	}
	const reference = boundaryReference(checker, node);
	if (reference === `effect.Effect.${name}` || reference === `effect/Effect.${name}`) {
		return true;
	}
	const declaration = declarationOf(checker, node);
	if (declaration === undefined) {
		return false;
	}
	const path = declaration.getSourceFile().fileName.replaceAll("\\", "/");
	return (
		/\/effect\/(?:src|dist(?:\/dts)?)\/Effect\.(?:d\.)?ts$/u.test(path)
		&& (ts.isVariableDeclaration(declaration) || ts.isFunctionDeclaration(declaration))
		&& declaration.name !== undefined
		&& ts.isIdentifier(declaration.name)
		&& declaration.name.text === name
	);
}

export function declarationOf(checker: ts.TypeChecker, node: ts.Node): ts.Declaration | undefined {
	const symbol = ts.isShorthandPropertyAssignment(node.parent)
		? checker.getShorthandAssignmentValueSymbol(node.parent)
		: checker.getSymbolAtLocation(node);
	if (symbol === undefined) {
		return;
	}
	const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	return target.valueDeclaration ?? target.declarations?.[0];
}

export function resolvedValue(checker: ts.TypeChecker, expression: ts.Expression, seen = new Set<ts.Node>()): ts.Node {
	const value = unwrapExpression(expression);
	if (seen.has(value)) {
		return value;
	}
	seen.add(value);
	const declaration = declarationOf(checker, value);
	if (declaration !== undefined && ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
		return resolvedValue(checker, declaration.initializer, seen);
	}
	return declaration !== undefined && (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) ? declaration : value;
}

export function effectSuccess(checker: ts.TypeChecker, type: ts.Type): ts.Type | undefined {
	const brand = type.getProperty("~effect/Effect");
	const success = brand === undefined ? undefined : checker.getTypeOfSymbol(brand).getProperty("_A");
	return success === undefined ? undefined : checker.getTypeOfSymbol(success).getCallSignatures()[0]?.getReturnType();
}
