import ts from "typescript";
import { bindsModule, type ImportBinding } from "#rules/stories/importBindings.ts";
import { unwrapped } from "#rules/stories/syntax.ts";

const SHAPES = ["Exit", "Cause", "Result"];

export function shapeModule(node: ts.Expression, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	const value = unwrapped(node);
	return ts.isIdentifier(value) && SHAPES.some((shape) => bindsModule(bindings.get(value.text), shape, ["effect"]));
}

function shapeType(node: ts.Node | undefined, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	if (node === undefined) {
		return false;
	}
	if (ts.isQualifiedName(node) && ts.isIdentifier(node.left) && shapeModule(node.left, bindings)) {
		return true;
	}
	return ts.forEachChild(node, (child) => shapeType(child, bindings)) === true;
}

export function internalValue(
	expression: ts.Expression,
	bindings: ReadonlyMap<string, ImportBinding>,
	checker: ts.TypeChecker,
	seen = new Set<ts.Node>(),
): boolean {
	const value = unwrapped(expression);
	if (seen.has(value)) {
		return false;
	}
	seen.add(value);
	if (ts.isYieldExpression(value) && value.expression !== undefined) {
		return internalValue(value.expression, bindings, checker, seen);
	}
	if (ts.isCallExpression(value)) {
		const callee = unwrapped(value.expression);
		if (ts.isPropertyAccessExpression(callee) && shapeModule(callee.expression, bindings)) {
			return true;
		}
		if (ts.isPropertyAccessExpression(callee) && ["exit", "result"].includes(callee.name.text) && ts.isIdentifier(callee.expression)) {
			return bindsModule(bindings.get(callee.expression.text), "Effect", ["effect"]);
		}
	}
	if (ts.isAsExpression(expression) && shapeType(expression.type, bindings)) {
		return true;
	}
	if (ts.isIdentifier(value)) {
		const declarations = (checker.getSymbolAtLocation(value)?.declarations ?? []).filter(ts.isVariableDeclaration);
		return declarations.some(
			(declaration) =>
				shapeType(declaration.type, bindings)
				|| (declaration.initializer !== undefined && internalValue(declaration.initializer, bindings, checker, seen)),
		);
	}
	return false;
}
