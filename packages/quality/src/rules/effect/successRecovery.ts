import ts from "typescript";
import { returnValues } from "#rules/stories/returnValues.ts";
import { effectName } from "./failureOperations.ts";

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
