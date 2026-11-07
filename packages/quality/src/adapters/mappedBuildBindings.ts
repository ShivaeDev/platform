import ts from "typescript";
import { type BuildBindings, buildEntryValue } from "#adapters/buildEntryValue.ts";
import { buildArguments, buildHelper } from "#adapters/buildHelper.ts";

function returnedValue(helper: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction): ts.Expression | undefined {
	if (helper.body === undefined) {
		return undefined;
	}
	if (ts.isBlock(helper.body)) {
		for (const statement of helper.body.statements) {
			if (ts.isReturnStatement(statement) && statement.expression !== undefined) {
				return statement.expression;
			}
		}
		return undefined;
	}
	return helper.body;
}

export function mappedBuildBindings(node: ts.Node, bindings: BuildBindings, sources: ReadonlyMap<string, ts.SourceFile>): readonly BuildBindings[] {
	if (!((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isCallExpression(node.parent))) {
		return [bindings];
	}
	const callee = node.parent.expression;
	const parameter = node.parameters[0];
	if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "map" || parameter === undefined) {
		return [bindings];
	}
	let array = buildEntryValue(callee.expression, new Set(), bindings);
	let arrayBindings = bindings;
	if (ts.isCallExpression(array)) {
		const helper = buildHelper(array, sources, bindings);
		const returned = helper === undefined ? undefined : returnedValue(helper);
		if (helper !== undefined && returned !== undefined) {
			arrayBindings = buildArguments(helper, array, bindings);
			array = buildEntryValue(returned, new Set(), arrayBindings);
		}
	}
	if (!ts.isArrayLiteralExpression(array)) {
		return [bindings];
	}
	return array.elements.map((element) => new Map([...arrayBindings, [parameter, buildEntryValue(element, new Set(), arrayBindings)]]));
}
