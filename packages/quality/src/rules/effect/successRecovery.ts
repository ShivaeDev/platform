import ts from "typescript";
import { effectName } from "#rules/effect/failureOperations.ts";
import { returnValues } from "#rules/stories/returnValues.ts";

function success(checker: ts.TypeChecker, node: ts.Node, seen: Set<ts.Symbol>): boolean {
	if (ts.isParenthesizedExpression(node)) {
		return success(checker, node.expression, seen);
	}
	if (ts.isConditionalExpression(node)) {
		return success(checker, node.whenTrue, new Set(seen)) && success(checker, node.whenFalse, new Set(seen));
	}
	if (ts.isIdentifier(node)) {
		const symbol = checker.getSymbolAtLocation(node);
		if (symbol !== undefined && !seen.has(symbol)) {
			seen.add(symbol);
			const declaration = symbol.valueDeclaration;
			if (declaration !== undefined && ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
				return success(checker, declaration.initializer, seen);
			}
		}
	}
	return effectName(checker, ts.isCallExpression(node) ? node.expression : node) === (ts.isCallExpression(node) ? "succeed" : "void");
}

export function successRecovery(checker: ts.TypeChecker, handler: ts.Node, seen = new Set<ts.Symbol>()): boolean {
	if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler) || ts.isFunctionDeclaration(handler)) {
		const values = returnValues(handler);
		return values.length > 0 && values.every((value) => value !== undefined && success(checker, value, new Set()));
	}
	if (effectName(checker, handler) === "succeed") {
		return true;
	}
	const symbol = checker.getSymbolAtLocation(handler);
	if (symbol === undefined || seen.has(symbol)) {
		return false;
	}
	seen.add(symbol);
	return (symbol.declarations ?? []).some((declaration) => {
		if (ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
			return successRecovery(checker, declaration.initializer, seen);
		}
		return ts.isFunctionDeclaration(declaration) && successRecovery(checker, declaration, seen);
	});
}

function mentions(checker: ts.TypeChecker, node: ts.Node, symbol: ts.Symbol): boolean {
	if (ts.isIdentifier(node) && checker.getSymbolAtLocation(node) === symbol) {
		return true;
	}
	return ts.forEachChild(node, (child) => mentions(checker, child, symbol) || undefined) ?? false;
}

function derivesFrom(checker: ts.TypeChecker, value: ts.Node, error: ts.Symbol): boolean {
	if (ts.isParenthesizedExpression(value)) {
		return derivesFrom(checker, value.expression, error);
	}
	if (ts.isConditionalExpression(value)) {
		return derivesFrom(checker, value.whenTrue, error) && derivesFrom(checker, value.whenFalse, error);
	}
	return ts.isCallExpression(value) && value.arguments.some((argument) => mentions(checker, argument, error));
}

export function translatesFailure(checker: ts.TypeChecker, handler: ts.Node): boolean {
	if (!(ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))) {
		return false;
	}
	const name = handler.parameters[0]?.name;
	const error = name !== undefined && ts.isIdentifier(name) ? checker.getSymbolAtLocation(name) : undefined;
	return error !== undefined && returnValues(handler).every((value) => value !== undefined && derivesFrom(checker, value, error));
}
