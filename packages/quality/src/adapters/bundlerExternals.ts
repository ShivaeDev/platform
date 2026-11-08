import ts from "typescript";
import { type BuildBindings, buildEntryValue, buildOption, declaredValue } from "#adapters/buildEntryValue.ts";
import { importedSource } from "#adapters/buildHelper.ts";
import { importedName } from "#adapters/importedCall.ts";
import { packageNameOf } from "#imports/packageName.ts";

function importedValue(node: ts.Identifier, sources: ReadonlyMap<string, ts.SourceFile>): ts.Expression | undefined {
	const imported = importedName(node);
	const source = imported === undefined ? undefined : importedSource(node, imported.module, sources);
	return source === undefined || imported === undefined ? undefined : declaredValue(source.statements, imported.name);
}

function externalNames(
	expression: ts.Expression,
	bindings: BuildBindings,
	sources: ReadonlyMap<string, ts.SourceFile>,
	active: ReadonlySet<ts.Node>,
): readonly string[] {
	const node = buildEntryValue(expression, new Set(), bindings);
	if (active.has(node)) {
		return [];
	}
	const visited = new Set([...active, node]);
	function names(value: ts.Expression) {
		return externalNames(value, bindings, sources, visited);
	}
	if (ts.isStringLiteralLike(node)) {
		return [node.text];
	}
	if (ts.isSpreadElement(node)) {
		return names(node.expression);
	}
	if (ts.isArrayLiteralExpression(node)) {
		return node.elements.flatMap(names);
	}
	if (ts.isIdentifier(node)) {
		const value = importedValue(node, sources);
		return value === undefined ? [] : names(value);
	}
	// A filter keeps only names the list already declares external, so the whole list stands in for its predicate.
	return ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "filter"
		? names(node.expression.expression)
		: [];
}

export function bundlerExternals(
	options: ts.ObjectLiteralExpression,
	bindings: BuildBindings,
	sources: ReadonlyMap<string, ts.SourceFile>,
): readonly string[] {
	const external = buildOption(options, "external");
	return external === undefined
		? []
		: externalNames(external, bindings, sources, new Set())
				.filter((name) => !(name.startsWith(".") || name.startsWith("/")))
				.map(packageNameOf);
}
