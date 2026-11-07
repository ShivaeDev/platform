import ts from "typescript";
import { type BuildBindings, buildEntryValue } from "#adapters/buildEntryValue.ts";

export function mappedBuildBindings(node: ts.Node, bindings: BuildBindings): readonly BuildBindings[] {
	if (!((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isCallExpression(node.parent))) {
		return [bindings];
	}
	const callee = node.parent.expression;
	const parameter = node.parameters[0];
	if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "map" || parameter === undefined) {
		return [bindings];
	}
	const array = buildEntryValue(callee.expression, new Set(), bindings);
	if (!ts.isArrayLiteralExpression(array)) {
		return [bindings];
	}
	return array.elements.map((element) => new Map([...bindings, [parameter, buildEntryValue(element, new Set(), bindings)]]));
}
