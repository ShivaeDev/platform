import ts from "typescript";
import { importBindings } from "#rules/stories/importBindings.ts";

function constantOrigins(source: ts.SourceFile, origins: Map<string, string>): void {
	for (const statement of source.statements) {
		if (!ts.isVariableStatement(statement) || (statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
			continue;
		}
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
				continue;
			}
			const origin = originOf(declaration.initializer, origins);
			if (origin !== undefined) {
				origins.set(declaration.name.text, origin);
			}
		}
	}
}

export function importOrigins(source: ts.SourceFile): ReadonlyMap<string, string> {
	const origins = new Map([...importBindings(source)].map(([name, binding]) => [name, binding.module]));
	constantOrigins(source, origins);
	return origins;
}

export function originOf(node: ts.Node, origins: ReadonlyMap<string, string>): string | undefined {
	if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
		return originOf(node.expression, origins);
	}
	if (ts.isIdentifier(node)) {
		return origins.get(node.text);
	}
	if (ts.isPropertyAccessExpression(node)) {
		return originOf(node.expression, origins);
	}
	return undefined;
}
