import ts from "typescript";
import { unwrapped } from "./syntax.ts";

function retryKey(name: ts.PropertyName | undefined): boolean {
	if (name === undefined) {
		return false;
	}
	const key = ts.isComputedPropertyName(name) ? unwrapped(name.expression) : name;
	return (ts.isIdentifier(key) && !ts.isComputedPropertyName(name) && key.text === "retry") || (ts.isStringLiteralLike(key) && key.text === "retry");
}

function initializers(node: ts.Expression, checker: ts.TypeChecker): readonly ts.Expression[] {
	if (!(ts.isIdentifier(node) || ts.isPropertyAccessExpression(node))) {
		return [];
	}
	const symbol = checker.getSymbolAtLocation(node);
	const target = symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	return (target?.declarations ?? []).flatMap((declaration) =>
		(ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration)) && declaration.initializer !== undefined
			? [declaration.initializer]
			: [],
	);
}

export function retryOption(checker: ts.TypeChecker) {
	function visit(expression: ts.Expression, seen: Set<ts.Node>): boolean {
		const node = unwrapped(expression);
		if (seen.has(node)) {
			return false;
		}
		seen.add(node);
		if (ts.isObjectLiteralExpression(node)) {
			return node.properties.some((property) => retryKey(property.name) || (ts.isSpreadAssignment(property) && visit(property.expression, seen)));
		}
		if (ts.isConditionalExpression(node)) {
			return visit(node.whenTrue, seen) || visit(node.whenFalse, seen);
		}
		return initializers(node, checker).some((value) => visit(value, seen));
	}
	return (expression: ts.Expression) => visit(expression, new Set());
}
